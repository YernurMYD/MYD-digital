import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('device_telemetry')
export class DeviceTelemetry {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  @Index()
  deviceId: string;

  @Column({ type: 'timestamptz', name: 'recorded_at', default: () => 'NOW()' })
  recordedAt: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'cpu_usage_percent' })
  cpuUsagePercent?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'cpu_temperature_celsius' })
  cpuTemperatureCelsius?: number;

  @Column({ type: 'int', nullable: true, name: 'cpu_frequency_mhz' })
  cpuFrequencyMhz?: number;

  @Column({ type: 'int', nullable: true, name: 'ram_used_mb' })
  ramUsedMb?: number;

  @Column({ type: 'int', nullable: true, name: 'ram_total_mb' })
  ramTotalMb?: number;

  @Column({ type: 'int', nullable: true, name: 'storage_used_mb' })
  storageUsedMb?: number;

  @Column({ type: 'int', nullable: true, name: 'storage_total_mb' })
  storageTotalMb?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'storage_health_percent' })
  storageHealthPercent?: number;

  @Column({ type: 'bigint', nullable: true, default: 0, name: 'storage_read_errors' })
  storageReadErrors?: number;

  @Column({ type: 'bigint', nullable: true, default: 0, name: 'storage_write_errors' })
  storageWriteErrors?: number;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'network_type' })
  networkType?: string;

  @Column({ type: 'int', nullable: true, name: 'network_signal_dbm' })
  networkSignalDbm?: number;

  @Column({ type: 'int', nullable: true, name: 'bandwidth_up_kbps' })
  bandwidthUpKbps?: number;

  @Column({ type: 'int', nullable: true, name: 'bandwidth_down_kbps' })
  bandwidthDownKbps?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'packet_loss_percent' })
  packetLossPercent?: number;

  @Column({ type: 'boolean', nullable: true, default: true, name: 'display_connected' })
  displayConnected?: boolean;

  @Column({ type: 'int', nullable: true, name: 'display_brightness' })
  displayBrightness?: number;

  @Column({ type: 'bigint', nullable: true, name: 'uptime_seconds' })
  uptimeSeconds?: number;

  @Column({ type: 'int', nullable: true, name: 'process_count' })
  processCount?: number;

  @Column({ type: 'int', nullable: true, name: 'player_pid' })
  playerPid?: number;

  @Column({ type: 'int', nullable: true, name: 'player_memory_mb' })
  playerMemoryMb?: number;
}
