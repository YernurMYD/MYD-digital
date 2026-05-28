import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { MediaFile } from './media-file.entity';

@Entity('campaign_items')
export class CampaignItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'campaign_id' })
  campaignId: string;

  @Column({ type: 'uuid', name: 'media_file_id' })
  mediaFileId: string;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'int', nullable: true, name: 'duration_override_ms' })
  durationOverrideMs?: number;

  @Column({ type: 'varchar', length: 50, default: 'crossfade', name: 'transition_type' })
  transitionType: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'NOW()' })
  createdAt: Date;

  @ManyToOne(() => Campaign, (campaign) => campaign.items)
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => MediaFile)
  @JoinColumn({ name: 'media_file_id' })
  mediaFile: MediaFile;
}
