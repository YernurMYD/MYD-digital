import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ScreenStatus } from '../../common/enums/role.enum';

@Entity('screens')
export class Screen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 500 })
  location: string;

  @Column({ name: 'slots_count', type: 'int' })
  slotsCount: number;

  @Column({ name: 'occupied_slots', type: 'int', default: 0 })
  occupiedSlots: number;

  @Column({ name: 'monthly_cost', type: 'numeric', precision: 12, scale: 2 })
  monthlyCost: number;

  @Column({ type: 'enum', enum: ScreenStatus, default: ScreenStatus.ACTIVE })
  status: ScreenStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
