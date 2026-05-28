import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DeviceAlert } from './entities/device-alert.entity';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

/**
 * Эвристический анализатор аномалий (VECTOR).
 *
 * Использует Redis для:
 *  - Скользящего окна метрик (последние N точек на устройство)
 *  - Heartbeat-трекинга (TTL-ключи для обнаружения offline)
 *  - Cooldown дедупликации алертов
 *
 * Детектируемые аномалии:
 *  1. Перегрев контроллера (> 80°C или резкий скачок > 15°C за 60 сек)
 *  2. Деградация SD-карты (health < 30 % или рост write errors)
 *  3. Утечка памяти плеера (монотонный рост > 20 % за окно)
 *  4. Отказ LED-модуля (дисплей отключился)
 *  5. Ошибки плеера (crash / OOM)
 */

const WINDOW_SIZE = 30;
const KEY_PREFIX = 'vector:';
const HEARTBEAT_TTL_SEC = 330; // 5 мин 30 сек — чуть больше 5 мин
const ALERT_COOLDOWN_SEC = 300;

interface MetricSnapshot {
  ts: number;
  cpuTemp: number | null;
  cpuUsage: number | null;
  ramUsed: number | null;
  ramTotal: number | null;
  storageHealth: number | null;
  storageWriteErrors: number | null;
  displayConnected: boolean | null;
  playerMemory: number | null;
}

@Injectable()
export class HeuristicAnalyzerService {
  private readonly logger = new Logger(HeuristicAnalyzerService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(DeviceAlert)
    private readonly alertRepo: Repository<DeviceAlert>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Основная точка входа: принимает метрики, обновляет Redis-окно,
   * регистрирует heartbeat и прогоняет все эвристики.
   */
  async analyze(deviceId: string, payload: TelemetryPayloadDto): Promise<void> {
    const snapshot = this.toSnapshot(payload);

    await this.pushSnapshot(deviceId, snapshot);
    await this.touchHeartbeat(deviceId);

    const window = await this.getWindow(deviceId);

    await Promise.all([
      this.checkOverheat(deviceId, window),
      this.checkStorageDegradation(deviceId, snapshot),
      this.checkMemoryLeak(deviceId, window),
      this.checkDisplayFailure(deviceId, snapshot),
    ]);
  }

  async reportPlayerError(deviceId: string, error: string): Promise<void> {
    await this.emitAlert(deviceId, 'critical', 'player.crash', `Ошибка плеера: ${error}`);
  }

  // ─── Heartbeat ──────────────────────────────────────────────

  async touchHeartbeat(deviceId: string): Promise<void> {
    await this.redis.setex(`${KEY_PREFIX}hb:${deviceId}`, HEARTBEAT_TTL_SEC, Date.now().toString());
  }

  async isDeviceOnline(deviceId: string): Promise<boolean> {
    return (await this.redis.exists(`${KEY_PREFIX}hb:${deviceId}`)) === 1;
  }

  async getLastHeartbeatTs(deviceId: string): Promise<number | null> {
    const val = await this.redis.get(`${KEY_PREFIX}hb:${deviceId}`);
    return val ? Number(val) : null;
  }

  // ─── Скользящее окно метрик (Redis List) ────────────────────

  private async pushSnapshot(deviceId: string, snap: MetricSnapshot): Promise<void> {
    const key = `${KEY_PREFIX}win:${deviceId}`;
    await this.redis.rpush(key, JSON.stringify(snap));
    await this.redis.ltrim(key, -WINDOW_SIZE, -1);
    await this.redis.expire(key, 3600);
  }

  private async getWindow(deviceId: string): Promise<MetricSnapshot[]> {
    const key = `${KEY_PREFIX}win:${deviceId}`;
    const raw = await this.redis.lrange(key, 0, -1);
    return raw.map((r) => JSON.parse(r));
  }

  // ─── Эвристика 1: Перегрев ──────────────────────────────────

  private async checkOverheat(deviceId: string, window: MetricSnapshot[]) {
    const latest = window[window.length - 1];
    if (!latest?.cpuTemp) return;

    // Абсолютный порог
    if (latest.cpuTemp > 80) {
      await this.emitAlert(
        deviceId,
        'critical',
        'overheat.absolute',
        `Критический перегрев CPU: ${latest.cpuTemp}°C (порог 80°C)`,
      );
      return;
    }

    // Резкий скачок: ΔT > 15°C за последние записи в окне (~ 60 сек)
    if (window.length >= 5) {
      const older = window[window.length - 5];
      if (older?.cpuTemp && latest.cpuTemp - older.cpuTemp > 15) {
        await this.emitAlert(
          deviceId,
          'warning',
          'overheat.spike',
          `Резкий рост температуры CPU: ${older.cpuTemp}°C → ${latest.cpuTemp}°C за ~60 сек`,
        );
      }
    }
  }

  // ─── Эвристика 2: Деградация SD-карты ──────────────────────

  private async checkStorageDegradation(deviceId: string, snap: MetricSnapshot) {
    if (snap.storageHealth !== null && snap.storageHealth < 30) {
      await this.emitAlert(
        deviceId,
        'warning',
        'storage.degradation',
        `Здоровье SD-карты критически низкое: ${snap.storageHealth}%`,
      );
    }

    if (snap.storageWriteErrors !== null && snap.storageWriteErrors > 0) {
      const prevKey = `${KEY_PREFIX}swe:${deviceId}`;
      const prev = Number(await this.redis.get(prevKey)) || 0;
      await this.redis.setex(prevKey, 3600, snap.storageWriteErrors.toString());

      if (prev > 0 && snap.storageWriteErrors - prev > 100) {
        await this.emitAlert(
          deviceId,
          'critical',
          'storage.write_errors',
          `Рост ошибок записи SD: ${prev} → ${snap.storageWriteErrors} (+${snap.storageWriteErrors - prev})`,
        );
      }
    }
  }

  // ─── Эвристика 3: Утечка памяти плеера ─────────────────────

  private async checkMemoryLeak(deviceId: string, window: MetricSnapshot[]) {
    const memPoints = window
      .filter((s) => s.playerMemory !== null)
      .map((s) => s.playerMemory!);

    if (memPoints.length < 10) return;

    const first = memPoints[0];
    const last = memPoints[memPoints.length - 1];

    // Монотонный рост > 20 %
    if (last > first * 1.2) {
      const isMonotonic = memPoints.every((v, i) => i === 0 || v >= memPoints[i - 1] * 0.98);
      if (isMonotonic) {
        await this.emitAlert(
          deviceId,
          'warning',
          'player.memory_leak',
          `Подозрение на утечку памяти плеера: ${first} MB → ${last} MB (+${((last / first - 1) * 100).toFixed(0)}%)`,
        );
      }
    }
  }

  // ─── Эвристика 4: Отказ LED-модуля / дисплея ───────────────

  private async checkDisplayFailure(deviceId: string, snap: MetricSnapshot) {
    if (snap.displayConnected === false) {
      await this.emitAlert(
        deviceId,
        'critical',
        'display.disconnected',
        'LED-модуль / дисплей отключён — возможен отказ модуля или кабеля',
      );
    }
  }

  // ─── Эмиссия алерта с дедупликацией через Redis cooldown ───

  private async emitAlert(
    deviceId: string,
    severity: string,
    alertType: string,
    message: string,
  ): Promise<void> {
    const cooldownKey = `${KEY_PREFIX}cd:${deviceId}:${alertType}`;
    const exists = await this.redis.exists(cooldownKey);
    if (exists) return;

    await this.redis.setex(cooldownKey, ALERT_COOLDOWN_SEC, '1');

    const alert = this.alertRepo.create({
      deviceId,
      severity,
      alertType,
      message,
    });
    await this.alertRepo.save(alert);

    this.eventEmitter.emit('alert.triggered', {
      alertId: alert.id,
      deviceId,
      severity,
      alertType,
      message,
      channels: severity === 'critical' ? ['telegram', 'dashboard'] : ['dashboard'],
    });

    this.logger.warn(`[${severity.toUpperCase()}] ${deviceId}: ${message}`);
  }

  // ─── Маппинг ───────────────────────────────────────────────

  private toSnapshot(p: TelemetryPayloadDto): MetricSnapshot {
    return {
      ts: p.timestamp ? new Date(p.timestamp).getTime() : Date.now(),
      cpuTemp: p.cpu?.temperatureCelsius ?? null,
      cpuUsage: p.cpu?.usagePercent ?? null,
      ramUsed: p.memory?.usedMb ?? null,
      ramTotal: p.memory?.totalMb ?? null,
      storageHealth: p.storage?.healthPercent ?? null,
      storageWriteErrors: p.storage?.writeErrors ?? null,
      displayConnected: p.display?.connected ?? null,
      playerMemory: p.system?.playerMemoryMb ?? null,
    };
  }
}
