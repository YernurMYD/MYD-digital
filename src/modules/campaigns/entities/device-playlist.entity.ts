import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('device_playlists')
export class DevicePlaylist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'date', name: 'generated_for_date' })
  generatedForDate: Date;

  @Column({ type: 'jsonb', name: 'playlist_data' })
  playlistData: any;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'timestamptz', name: 'generated_at', default: () => 'NOW()' })
  generatedAt: Date;
}
