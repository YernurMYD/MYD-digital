import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

/**
 * Offline Watchdog — периодический обход всех устройств,
 * обнаружение тех, что не отправляли heartbeat > 5 минут,
 * с последующей отправкой события device.offline → Telegram.
 *
 * Механизм:
 *  1. Каждое устройство при отправке метрик проставляет
 *     Redis-ключ vector:hb:{deviceId} с TTL = 5 мин 30 сек
 *     (делает HeuristicAnalyzerService.touchHeartbeat).
 *  2. Watchdog каждые 60 сек сканирует таблицу devices
 *     (is_online = true) и проверяет наличие heartbeat-ключа.
 *  3. Если ключа нет — устройство offline > 5 мин.
 *  4. Эмитится событие device.offline (слушает TelegramNotifierService).
 *  5. Redis-cooldown предотвращает повторную отправку.
 */

interface DeviceRow {
  id: string;
  name: string;
  serial_number: string;
  organization_id: string;
}

const CHECK_INTERVAL_MS = 60_000;
const OFFLINE_ALERT_COOLDOWN_SEC = 1800; // 30 мин между повторными алертами
const KEY_PREFIX = 'vector:';

@Injectable()
export class OfflineWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfflineWatchdogService.name);
  private timer: NodeJS.Timeout;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository('devices')
    private readonly deviceRepo: Repository<any>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.scan(), CHECK_INTERVAL_MS);
    this.logger.log('Offline watchdog started (interval: 60s)');
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async scan(): Promise<void> {
    let onlineDevices: DeviceRow[];
    try {
      onlineDevices = await this.deviceRepo.query(
        `SELECT id, name, serial_number, organization_id
         FROM devices WHERE is_online = true`,
      );
    } catch (err) {
      this.logger.error(`Failed to query devices: ${err.message}`);
      return;
    }

    let offlineCount = 0;

    for (const device of onlineDevices) {
      const hbKey = `${KEY_PREFIX}hb:${device.id}`;
      const exists = await this.redis.exists(hbKey);

      if (exists) continue;

      // Heartbeat отсутствует → устройство не отвечало > 5 мин
      offlineCount++;

      const cooldownKey = `${KEY_PREFIX}offline-cd:${device.id}`;
      const alreadyNotified = await this.redis.exists(cooldownKey);
      if (alreadyNotified) continue;

      await this.redis.setex(cooldownKey, OFFLINE_ALERT_COOLDOWN_SEC, '1');

      // Обновить статус в БД
      await this.deviceRepo.query(
        `UPDATE devices SET is_online = false WHERE id = $1`,
        [device.id],
      );

      this.eventEmitter.emit('device.offline', {
        deviceId: device.id,
        deviceName: device.name,
        serialNumber: device.serial_number,
        organizationId: device.organization_id,
        offlineMinutes: 5,
      });

      this.logger.warn(`Device offline > 5 min: ${device.name} (${device.id})`);
    }

    if (offlineCount > 0) {
      this.logger.log(`Scan complete: ${offlineCount}/${onlineDevices.length} devices offline`);
    }
  }
}
