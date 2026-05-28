import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MonitoringRule } from './entities/monitoring-rule.entity';
import { DeviceAlert } from './entities/device-alert.entity';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

interface RuleEvalContext {
  deviceId: string;
  metrics: TelemetryPayloadDto;
}

@Injectable()
@Processor('telemetry')
export class MonitoringRulesEngine {
  private readonly logger = new Logger(MonitoringRulesEngine.name);
  private rulesCache: MonitoringRule[] = [];
  private lastCacheRefresh = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    @InjectRepository(MonitoringRule)
    private readonly ruleRepo: Repository<MonitoringRule>,
    @InjectRepository(DeviceAlert)
    private readonly alertRepo: Repository<DeviceAlert>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('evaluate-rules')
  async evaluateRules(job: Job<RuleEvalContext>) {
    const { deviceId, metrics } = job.data;
    const rules = await this.getRules();

    for (const rule of rules) {
      const actualValue = this.extractMetricValue(metrics, rule.metricName);
      if (actualValue === null || actualValue === undefined) continue;

      const violated = this.checkCondition(actualValue, rule.conditionOperator, rule.thresholdValue);

      if (violated) {
        await this.handleViolation(deviceId, rule, actualValue);
      }
    }
  }

  private async getRules(): Promise<MonitoringRule[]> {
    const now = Date.now();
    if (now - this.lastCacheRefresh > this.CACHE_TTL_MS) {
      this.rulesCache = await this.ruleRepo.find({ where: { isActive: true } });
      this.lastCacheRefresh = now;
    }
    return this.rulesCache;
  }

  private extractMetricValue(metrics: TelemetryPayloadDto, metricName: string): number | null {
    const metricMap: Record<string, () => number | undefined> = {
      'cpu.usagePercent': () => metrics.cpu?.usagePercent,
      'cpu.temperatureCelsius': () => metrics.cpu?.temperatureCelsius,
      'memory.usagePercent': () =>
        metrics.memory?.totalMb
          ? (metrics.memory.usedMb / metrics.memory.totalMb) * 100
          : undefined,
      'storage.healthPercent': () => metrics.storage?.healthPercent,
      'storage.usagePercent': () =>
        metrics.storage?.totalMb
          ? (metrics.storage.usedMb / metrics.storage.totalMb) * 100
          : undefined,
      'network.packetLossPercent': () => metrics.network?.packetLossPercent,
    };

    const extractor = metricMap[metricName];
    if (!extractor) return null;

    const value = extractor();
    return value ?? null;
  }

  private checkCondition(actual: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return actual > threshold;
      case '>=': return actual >= threshold;
      case '<': return actual < threshold;
      case '<=': return actual <= threshold;
      case '==': return actual === threshold;
      default: return false;
    }
  }

  private async handleViolation(
    deviceId: string,
    rule: MonitoringRule,
    actualValue: number,
  ) {
    const recentAlert = await this.alertRepo
      .createQueryBuilder('a')
      .where('a.deviceId = :deviceId', { deviceId })
      .andWhere('a.alertType = :type', { type: rule.metricName })
      .andWhere('a.status = :status', { status: 'active' })
      .andWhere('a.triggeredAt > :cooldown', {
        cooldown: new Date(Date.now() - rule.cooldownMinutes * 60_000),
      })
      .getOne();

    if (recentAlert) return;

    const alert = this.alertRepo.create({
      deviceId,
      severity: rule.severity,
      alertType: rule.metricName,
      message: `${rule.name}: ${rule.metricName} = ${actualValue} (порог: ${rule.conditionOperator} ${rule.thresholdValue})`,
      thresholdValue: rule.thresholdValue,
      actualValue,
    });

    await this.alertRepo.save(alert);

    this.eventEmitter.emit('alert.triggered', {
      alertId: alert.id,
      deviceId,
      severity: rule.severity,
      message: alert.message,
      channels: rule.notifyChannels,
    });

    this.logger.warn(`Alert triggered: device=${deviceId}, rule=${rule.name}, value=${actualValue}`);
  }
}
