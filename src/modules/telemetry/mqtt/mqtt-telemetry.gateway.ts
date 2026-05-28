import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { TelemetryService } from '../telemetry.service';
import { HeuristicAnalyzerService } from '../heuristic-analyzer.service';
import { TelemetryPayloadDto } from '../dto/telemetry-payload.dto';

/**
 * MQTT-шлюз для приёма телеметрии от тысяч устройств.
 *
 * Топики:
 *   devices/{deviceId}/status/cpu   — CPU usage %, температура, частота
 *   devices/{deviceId}/status/temp  — температура корпуса, куллеров
 *   devices/{deviceId}/status/full  — полный снимок всех метрик
 *   devices/{deviceId}/errors/player — ошибки плеера (crash, OOM)
 *
 * Payload: JSON, соответствующий секции TelemetryPayloadDto.
 */

const TOPIC_PATTERNS = [
  'devices/+/status/cpu',
  'devices/+/status/temp',
  'devices/+/status/full',
  'devices/+/errors/player',
] as const;

interface PartialCpuPayload {
  usagePercent?: number;
  temperatureCelsius?: number;
  frequencyMhz?: number;
}

interface PartialTempPayload {
  cpuTemperature?: number;
  boardTemperature?: number;
  fanRpm?: number;
}

interface PlayerErrorPayload {
  error: string;
  pid?: number;
  memoryMb?: number;
  timestamp?: string;
}

@Injectable()
export class MqttTelemetryGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttTelemetryGateway.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly config: ConfigService,
    private readonly telemetryService: TelemetryService,
    private readonly analyzer: HeuristicAnalyzerService,
  ) {}

  onModuleInit() {
    const brokerUrl = this.config.get<string>('MQTT_BROKER_URL', 'mqtt://localhost:1883');
    const username = this.config.get<string>('MQTT_USERNAME', '');
    const password = this.config.get<string>('MQTT_PASSWORD', '');

    this.client = mqtt.connect(brokerUrl, {
      clientId: `vector-collector-${process.pid}`,
      clean: true,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
      ...(username && { username, password }),
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
      for (const pattern of TOPIC_PATTERNS) {
        this.client.subscribe(pattern, { qos: 1 }, (err) => {
          if (err) this.logger.error(`Subscribe failed for ${pattern}: ${err.message}`);
          else this.logger.log(`Subscribed: ${pattern}`);
        });
      }
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message).catch((err) =>
        this.logger.error(`Error processing ${topic}: ${err.message}`),
      );
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT error: ${err.message}`);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  private async handleMessage(topic: string, raw: Buffer): Promise<void> {
    const segments = topic.split('/');
    const deviceId = segments[1];
    const category = segments[2]; // 'status' | 'errors'
    const subtype = segments[3];  // 'cpu' | 'temp' | 'full' | 'player'

    if (!deviceId) return;

    let data: unknown;
    try {
      data = JSON.parse(raw.toString('utf8'));
    } catch {
      this.logger.warn(`Invalid JSON on ${topic}`);
      return;
    }

    if (category === 'status') {
      const payload = this.buildPayloadFromTopic(deviceId, subtype, data);
      if (payload) {
        await this.telemetryService.ingest(payload);
        await this.analyzer.analyze(deviceId, payload);
      }
    } else if (category === 'errors' && subtype === 'player') {
      await this.handlePlayerError(deviceId, data as PlayerErrorPayload);
    }
  }

  private buildPayloadFromTopic(
    deviceId: string,
    subtype: string,
    data: unknown,
  ): TelemetryPayloadDto | null {
    switch (subtype) {
      case 'cpu': {
        const d = data as PartialCpuPayload;
        const payload = new TelemetryPayloadDto();
        payload.deviceId = deviceId;
        payload.cpu = {
          usagePercent: d.usagePercent ?? 0,
          temperatureCelsius: d.temperatureCelsius,
          frequencyMhz: d.frequencyMhz,
        };
        payload.memory = { usedMb: 0, totalMb: 0 };
        payload.storage = { usedMb: 0, totalMb: 0 };
        return payload;
      }

      case 'temp': {
        const d = data as PartialTempPayload;
        const payload = new TelemetryPayloadDto();
        payload.deviceId = deviceId;
        payload.cpu = {
          usagePercent: 0,
          temperatureCelsius: d.cpuTemperature,
        };
        payload.memory = { usedMb: 0, totalMb: 0 };
        payload.storage = { usedMb: 0, totalMb: 0 };
        return payload;
      }

      case 'full':
        return data as TelemetryPayloadDto;

      default:
        return null;
    }
  }

  private async handlePlayerError(deviceId: string, data: PlayerErrorPayload) {
    this.logger.warn(`Player error on device ${deviceId}: ${data.error}`);
    await this.analyzer.reportPlayerError(deviceId, data.error);
  }
}
