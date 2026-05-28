import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { CampaignItem } from './campaign-item.entity';
import { CampaignDeviceTarget } from './campaign-device-target.entity';
import { CampaignStatus, CampaignPriority } from '../campaigns.types';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ type: 'enum', enum: CampaignPriority, default: CampaignPriority.NORMAL })
  priority: CampaignPriority;

  @Column({ type: 'timestamptz', nullable: true, name: 'start_at' })
  startAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'end_at' })
  endAt?: Date;

  @Column({ type: 'time', nullable: true, name: 'daily_start_time' })
  dailyStartTime?: string;

  @Column({ type: 'time', nullable: true, name: 'daily_end_time' })
  dailyEndTime?: string;

  @Column({ type: 'int', array: true, default: '{1,2,3,4,5,6,7}', name: 'days_of_week' })
  daysOfWeek: number[];

  @Column({ type: 'boolean', default: false, name: 'is_emergency' })
  isEmergency: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'emergency_expires_at' })
  emergencyExpiresAt?: Date;

  @Column({ type: 'int', nullable: true, default: 0, name: 'repeat_interval_minutes' })
  repeatIntervalMinutes?: number;

  @Column({ type: 'int', nullable: true, name: 'max_impressions_per_day' })
  maxImpressionsPerDay?: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'NOW()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt?: Date;

  @OneToMany(() => CampaignItem, (item) => item.campaign)
  items: CampaignItem[];

  @OneToMany(() => CampaignDeviceTarget, (target) => target.campaign)
  targets: CampaignDeviceTarget[];
}
