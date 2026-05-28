import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('device_alerts')
export class DeviceAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 100, name: 'alert_type' })
  alertType: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'threshold_value' })
  thresholdValue?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'actual_value' })
  actualValue?: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', name: 'triggered_at', default: () => 'NOW()' })
  triggeredAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'acknowledged_at' })
  acknowledgedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'acknowledged_by' })
  acknowledgedBy?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt?: Date;
}
