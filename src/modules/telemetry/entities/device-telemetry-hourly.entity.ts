import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('device_telemetry_hourly')
export class DeviceTelemetryHourly {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  @Index()
  deviceId: string;

  @Column({ type: 'timestamptz', name: 'hour_start' })
  hourStart: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'cpu_usage_avg' })
  cpuUsageAvg?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'cpu_usage_max' })
  cpuUsageMax?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'cpu_temp_avg' })
  cpuTempAvg?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'cpu_temp_max' })
  cpuTempMax?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'ram_usage_avg_percent' })
  ramUsageAvgPercent?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'storage_health_min' })
  storageHealthMin?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'network_packet_loss_avg' })
  networkPacketLossAvg?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'uptime_percent' })
  uptimePercent?: number;

  @Column({ type: 'int', default: 0, name: 'sample_count' })
  sampleCount: number;
}
