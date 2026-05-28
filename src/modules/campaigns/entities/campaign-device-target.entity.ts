import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Campaign } from './campaign.entity';

@Entity('campaign_device_targets')
export class CampaignDeviceTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'campaign_id' })
  campaignId: string;

  @Column({ type: 'uuid', nullable: true, name: 'device_id' })
  deviceId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'device_group_id' })
  deviceGroupId?: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.targets)
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;
}
