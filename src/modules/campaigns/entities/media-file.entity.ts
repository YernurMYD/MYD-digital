import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('media_files')
export class MediaFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ type: 'varchar', length: 500, name: 'original_name' })
  originalName: string;

  @Column({ type: 'varchar', length: 1000, name: 'storage_path' })
  storagePath: string;

  @Column({ type: 'varchar', length: 100, name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize: number;

  @Column({ type: 'varchar', length: 20, default: 'video', name: 'media_type' })
  mediaType: string;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs?: number;

  @Column({ type: 'int', nullable: true })
  width?: number;

  @Column({ type: 'int', nullable: true })
  height?: number;

  @Column({ type: 'varchar', length: 1000, nullable: true, name: 'thumbnail_path' })
  thumbnailPath?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'transcode_status' })
  transcodeStatus: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'NOW()' })
  createdAt: Date;
}
