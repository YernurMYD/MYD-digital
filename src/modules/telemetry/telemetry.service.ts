import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DeviceTelemetry } from './entities/device-telemetry.entity';
import { DeviceTelemetryHourly } from './entities/device-telemetry-hourly.entity';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { MonitoringRulesEngine } from './monitoring-rules.engine';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  private readonly writeBuffer: DeviceTelemetry[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private flushTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(DeviceTelemetry)
    private readonly telemetryRepo: Repository<DeviceTelemetry>,
    @InjectRepository(DeviceTelemetryHourly)
    private readonly hourlyRepo: Repository<DeviceTelemetryHourly>,
    @InjectQueue('telemetry')
    private readonly telemetryQueue: Queue,
    private readonly rulesEngine: MonitoringRulesEngine,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.flushTimer = setInterval(() => this.flushBuffer(), this.FLUSH_INTERVAL_MS);
  }

  /**
   * Приём одной точки телеметрии.
   * Данные буферизуются и пишутся пакетно для снижения нагрузки на БД.
   */
  async ingest(payload: TelemetryPayloadDto): Promise<{ accepted: true }> {
    const record = this.mapPayloadToEntity(payload);
    this.writeBuffer.push(record);

    if (this.writeBuffer.length >= this.BUFFER_SIZE) {
      await this.flushBuffer();
    }

    this.eventEmitter.emit('telemetry.received', {
      deviceId: payload.deviceId,
      timestamp: payload.timestamp,
    });

    await this.telemetryQueue.add('evaluate-rules', {
      deviceId: payload.deviceId,
      metrics: payload,
    });

    return { accepted: true };
  }

  async ingestBatch(payloads: TelemetryPayloadDto[]): Promise<{ accepted: number }> {
    const records = payloads.map((p) => this.mapPayloadToEntity(p));
    this.writeBuffer.push(...records);

    if (this.writeBuffer.length >= this.BUFFER_SIZE) {
      await this.flushBuffer();
    }

    for (const payload of payloads) {
      await this.telemetryQueue.add('evaluate-rules', {
        deviceId: payload.deviceId,
        metrics: payload,
      });
    }

    return { accepted: payloads.length };
  }

  private async flushBuffer(): Promise<void> {
    if (this.writeBuffer.length === 0) return;

    const batch = this.writeBuffer.splice(0, this.writeBuffer.length);

    try {
      await this.telemetryRepo
        .createQueryBuilder()
        .insert()
        .into(DeviceTelemetry)
        .values(batch)
        .execute();
    } catch (error) {
      this.logger.error(`Failed to flush telemetry buffer: ${error.message}`, error.stack);
      this.writeBuffer.unshift(...batch);
    }
  }

  async getDeviceMetrics(deviceId: string, query: TelemetryQueryDto) {
    const { from, to, interval } = query;

    if (interval === 'hourly') {
      return this.hourlyRepo
        .createQueryBuilder('h')
        .where('h.deviceId = :deviceId', { deviceId })
        .andWhere('h.hourStart >= :from', { from })
        .andWhere('h.hourStart <= :to', { to })
        .orderBy('h.hourStart', 'ASC')
        .getMany();
    }

    return this.telemetryRepo
      .createQueryBuilder('t')
      .where('t.deviceId = :deviceId', { deviceId })
      .andWhere('t.recordedAt >= :from', { from })
      .andWhere('t.recordedAt <= :to', { to })
      .orderBy('t.recordedAt', 'ASC')
      .limit(1000)
      .getMany();
  }

  async getLatestMetrics(deviceId: string): Promise<DeviceTelemetry | null> {
    return this.telemetryRepo.findOne({
      where: { deviceId },
      order: { recordedAt: 'DESC' },
    });
  }

  async getFleetOverview(organizationId: string) {
    const result = await this.telemetryRepo.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (t.device_id)
          t.*,
          d.name as device_name,
          d.is_online
        FROM device_telemetry t
        JOIN devices d ON d.id = t.device_id
        WHERE d.organization_id = $1
        ORDER BY t.device_id, t.recorded_at DESC
      )
      SELECT
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE is_online = true) as online_devices,
        COUNT(*) FILTER (WHERE cpu_temperature_celsius > 75) as overheating_devices,
        COUNT(*) FILTER (WHERE storage_health_percent < 50) as storage_warning_devices,
        AVG(cpu_usage_percent) as avg_cpu_usage,
        AVG(cpu_temperature_celsius) as avg_temperature,
        AVG(ram_used_mb::float / NULLIF(ram_total_mb, 0) * 100) as avg_ram_usage_percent
      FROM latest
      `,
      [organizationId],
    );

    return result[0] ?? {};
  }

  private mapPayloadToEntity(payload: TelemetryPayloadDto): DeviceTelemetry {
    const entity = new DeviceTelemetry();
    entity.deviceId = payload.deviceId;
    entity.recordedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    entity.cpuUsagePercent = payload.cpu?.usagePercent;
    entity.cpuTemperatureCelsius = payload.cpu?.temperatureCelsius;
    entity.cpuFrequencyMhz = payload.cpu?.frequencyMhz;
    entity.ramUsedMb = payload.memory?.usedMb;
    entity.ramTotalMb = payload.memory?.totalMb;
    entity.storageUsedMb = payload.storage?.usedMb;
    entity.storageTotalMb = payload.storage?.totalMb;
    entity.storageHealthPercent = payload.storage?.healthPercent;
    entity.storageReadErrors = payload.storage?.readErrors;
    entity.storageWriteErrors = payload.storage?.writeErrors;
    entity.networkType = payload.network?.type;
    entity.networkSignalDbm = payload.network?.signalDbm;
    entity.bandwidthUpKbps = payload.network?.bandwidthUpKbps;
    entity.bandwidthDownKbps = payload.network?.bandwidthDownKbps;
    entity.packetLossPercent = payload.network?.packetLossPercent;
    entity.displayConnected = payload.display?.connected;
    entity.displayBrightness = payload.display?.brightness;
    entity.uptimeSeconds = payload.system?.uptimeSeconds;
    entity.processCount = payload.system?.processCount;
    entity.playerPid = payload.system?.playerPid;
    entity.playerMemoryMb = payload.system?.playerMemoryMb;
    return entity;
  }
}
