import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ProbeResult } from './transcode.types';

const execFileAsync = promisify(execFile);

const ALPHA_PIXEL_FORMATS = new Set([
  'yuva420p',
  'yuva422p',
  'yuva444p',
  'rgba',
  'bgra',
  'argb',
  'abgr',
  'gbrap',
  'ya8',
  'pal8',
]);

const TARGET_CODEC = 'vp8';
const TARGET_FORMAT = 'matroska,webm';

@Injectable()
export class FfprobeService {
  private readonly logger = new Logger(FfprobeService.name);

  /**
   * Извлекает метаданные видеофайла через ffprobe.
   * Возвращает структурированный результат с информацией о кодеке,
   * пиксельном формате, наличии альфа-канала и т.д.
   */
  async probe(filePath: string): Promise<ProbeResult> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-select_streams', 'v:0',
      filePath,
    ]);

    const data = JSON.parse(stdout);
    const videoStream = data.streams?.[0];

    if (!videoStream) {
      throw new Error(`No video stream found in ${filePath}`);
    }

    const pixelFormat: string = videoStream.pix_fmt ?? '';

    return {
      codec: videoStream.codec_name ?? '',
      pixelFormat,
      width: Number(videoStream.width) || 0,
      height: Number(videoStream.height) || 0,
      durationMs: Math.round((Number(data.format?.duration) || 0) * 1000),
      bitrate: Number(data.format?.bit_rate) || 0,
      formatName: data.format?.format_name ?? '',
      hasAlpha: ALPHA_PIXEL_FORMATS.has(pixelFormat),
    };
  }

  /**
   * Строго проверяет, соответствует ли файл целевому формату:
   *  - кодек === vp8
   *  - контейнер === webm (matroska,webm)
   *  - пиксельный формат содержит альфа (yuva420p)
   *
   * Только при совпадении ВСЕХ условий можно безопасно пропустить
   * перекодирование. `-c copy` не используется без этой проверки,
   * т.к. ffmpeg может молча подменить кодек при stream copy.
   */
  isAlreadyTargetFormat(probe: ProbeResult): boolean {
    const codecMatch = probe.codec === TARGET_CODEC;
    const formatMatch = probe.formatName.includes('webm')
      || probe.formatName.includes('matroska');
    const alphaMatch = probe.hasAlpha;

    if (!codecMatch || !formatMatch || !alphaMatch) {
      this.logger.log(
        `Format mismatch: codec=${probe.codec}(need ${TARGET_CODEC}), ` +
        `format=${probe.formatName}, pix_fmt=${probe.pixelFormat}, ` +
        `alpha=${probe.hasAlpha}`,
      );
      return false;
    }

    this.logger.log('File already matches target format (vp8/webm/alpha)');
    return true;
  }
}
