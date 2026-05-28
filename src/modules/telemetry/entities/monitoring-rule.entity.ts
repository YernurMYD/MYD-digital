import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('monitoring_rules')
export class MonitoringRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, name: 'metric_name' })
  metricName: string;

  @Column({ type: 'varchar', length: 10, name: 'condition_operator' })
  conditionOperator: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'threshold_value' })
  thresholdValue: number;

  @Column({ type: 'varchar', length: 20, default: 'warning' })
  severity: string;

  @Column({ type: 'int', default: 5, name: 'cooldown_minutes' })
  cooldownMinutes: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '["dashboard"]', name: 'notify_channels' })
  notifyChannels: string[];

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'NOW()' })
  createdAt: Date;
}
