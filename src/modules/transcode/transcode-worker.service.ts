import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { stat, rename, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import { MediaFile } from '../campaigns/entities/media-file.entity';
import { FfprobeService } from './ffprobe.service';
import { TranscodeStatus, TranscodeResult } from './transcode.types';

const execFileAsync = promisify(execFile);

const VP8_QUALITY_CRF = 10;
const VP8_BITRATE = '0';
const VP8_THREADS = '4';
const VP8_DEADLINE = 'good';
const VP8_CPU_USED = '2';

@Injectable()
export class TranscodeWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TranscodeWorkerService.name);
  private queue: string[] = [];
  private processing = false;
  private activeProcess: ChildProcess | null = null;
  private shutdownRequested = false;

  constructor(
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
    private readonly ffprobe: FfprobeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.resumePending();
  }

  onModuleDestroy() {
    this.shutdownRequested = true;
    if (this.activeProcess && !this.activeProcess.killed) {
      this.activeProcess.kill('SIGTERM');
    }
  }

  @OnEvent('media.uploaded')
  handleMediaUploaded(payload: { mediaFileId: string }) {
    this.enqueue(payload.mediaFileId);
  }

  enqueue(mediaFileId: string) {
    if (this.queue.includes(mediaFileId)) return;
    this.queue.push(mediaFileId);
    this.processNext();
  }

  private async resumePending() {
    const pending = await this.mediaFileRepo.find({
      where: [
        { transcodeStatus: TranscodeStatus.PENDING },
        { transcodeStatus: TranscodeStatus.PROBING },
        { transcodeStatus: TranscodeStatus.PROCESSING },
      ],
    });

    if (pending.length) {
      this.logger.log(`Resuming ${pending.length} pending transcode jobs`);
      for (const file of pending) {
        this.enqueue(file.id);
      }
    }
  }

  private async processNext() {
    if (this.processing || this.shutdownRequested || !this.queue.length) return;

    this.processing = true;
    const mediaFileId = this.queue.shift()!;

    try {
      await this.processFile(mediaFileId);
    } catch (err) {
      this.logger.error(`Transcode failed for ${mediaFileId}: ${err.message}`);
      await this.updateStatus(mediaFileId, TranscodeStatus.FAILED, {
        error: err.message,
      });
    } finally {
      this.processing = false;
      this.activeProcess = null;
      this.processNext();
    }
  }

  private async processFile(mediaFileId: string): Promise<void> {
    const file = await this.mediaFileRepo.findOne({ where: { id: mediaFileId } });
    if (!file) {
      this.logger.warn(`Media file ${mediaFileId} not found, skipping`);
      return;
    }

    const inputPath = file.storagePath;

    // ─── 1. Probing: строгий анализ через ffprobe ──────────
    await this.updateStatus(mediaFileId, TranscodeStatus.PROBING);

    const probeResult = await this.ffprobe.probe(inputPath);

    await this.mediaFileRepo.update(mediaFileId, {
      width: probeResult.width,
      height: probeResult.height,
      durationMs: probeResult.durationMs,
      metadata: {
        ...file.metadata,
        probe: {
          codec: probeResult.codec,
          pixelFormat: probeResult.pixelFormat,
          bitrate: probeResult.bitrate,
          formatName: probeResult.formatName,
          hasAlpha: probeResult.hasAlpha,
        },
      },
    });

    // ─── 2. Проверка: нужна ли конвертация? ────────────────
    if (this.ffprobe.isAlreadyTargetFormat(probeResult)) {
      this.logger.log(`File ${mediaFileId} already VP8/WebM/alpha — skipping transcode`);
      await this.updateStatus(mediaFileId, TranscodeStatus.SKIPPED);
      this.eventEmitter.emit('media.transcoded', {
        mediaFileId,
        status: TranscodeStatus.SKIPPED,
      });
      return;
    }

    // ─── 3. Транскодирование: FFmpeg VP8 + WebM + alpha ────
    await this.updateStatus(mediaFileId, TranscodeStatus.PROCESSING);

    const result = await this.transcode(inputPath, probeResult.hasAlpha);

    // ─── 4. Замена оригинала и обновление БД ───────────────
    const fileStat = await stat(result.outputPath);

    await this.mediaFileRepo.update(mediaFileId, {
      storagePath: result.outputPath,
      mimeType: 'video/webm',
      fileSize: fileStat.size,
      width: result.width,
      height: result.height,
      durationMs: result.durationMs,
      transcodeStatus: TranscodeStatus.COMPLETED,
      metadata: {
        ...file.metadata,
        transcode: {
          originalPath: inputPath,
          completedAt: new Date().toISOString(),
        },
      },
    });

    this.eventEmitter.emit('media.transcoded', {
      mediaFileId,
      status: TranscodeStatus.COMPLETED,
      outputPath: result.outputPath,
    });

    this.logger.log(
      `Transcode completed: ${mediaFileId} → ${result.outputPath} (${(fileStat.size / 1048576).toFixed(1)} MB)`,
    );
  }

  /**
   * Запускает FFmpeg для конвертации в VP8/WebM.
   *
   * Аргументы подобраны для сохранения альфа-канала:
   *  -pix_fmt yuva420p   — формат с прозрачностью
   *  -auto-alt-ref 0     — обязательно для VP8 + alpha (без него ffmpeg падает)
   *  -metadata:s:v alpha_mode="1" — маркер альфа-канала для декодеров
   *
   * Если исходник не содержит альфа → используется yuv420p (меньший размер файла).
   */
  private async transcode(
    inputPath: string,
    sourceHasAlpha: boolean,
  ): Promise<TranscodeResult> {
    const parsed = path.parse(inputPath);
    const outputPath = path.join(parsed.dir, `${parsed.name}.webm`);
    const tempPath = path.join(parsed.dir, `${parsed.name}.tmp.webm`);

    const pixFmt = sourceHasAlpha ? 'yuva420p' : 'yuv420p';

    const args = [
      '-y',
      '-i', inputPath,
      '-c:v', 'libvpx',
      '-pix_fmt', pixFmt,
      '-quality', VP8_DEADLINE,
      '-cpu-used', VP8_CPU_USED,
      '-crf', String(VP8_QUALITY_CRF),
      '-b:v', VP8_BITRATE,
      '-threads', VP8_THREADS,
      '-auto-alt-ref', '0',
      ...(sourceHasAlpha
        ? ['-metadata:s:v', 'alpha_mode=1']
        : []),
      '-an',
      '-f', 'webm',
      tempPath,
    ];

    this.logger.debug(`FFmpeg args: ${args.join(' ')}`);

    await new Promise<void>((resolve, reject) => {
      this.activeProcess = execFile('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Валидация выходного файла через ffprobe
    const outProbe = await this.ffprobe.probe(tempPath);

    if (outProbe.codec !== 'vp8') {
      await unlink(tempPath).catch(() => {});
      throw new Error(
        `Post-transcode validation failed: output codec is "${outProbe.codec}", expected "vp8"`,
      );
    }

    // Атомарная замена: temp → финальный путь
    if (inputPath !== outputPath) {
      await rename(tempPath, outputPath);
    } else {
      const backupPath = `${inputPath}.bak`;
      await rename(inputPath, backupPath);
      await rename(tempPath, outputPath);
      await unlink(backupPath).catch(() => {});
    }

    return {
      outputPath,
      status: TranscodeStatus.COMPLETED,
      durationMs: outProbe.durationMs,
      width: outProbe.width,
      height: outProbe.height,
      fileSize: (await stat(outputPath)).size,
    };
  }

  private async updateStatus(
    mediaFileId: string,
    status: TranscodeStatus,
    extra?: Record<string, any>,
  ) {
    const update: Partial<MediaFile> = { transcodeStatus: status };

    if (extra) {
      const file = await this.mediaFileRepo.findOne({ where: { id: mediaFileId } });
      if (file) {
        update.metadata = { ...file.metadata, ...extra };
      }
    }

    await this.mediaFileRepo.update(mediaFileId, update);
  }
}
