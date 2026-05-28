import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceAlert } from './entities/device-alert.entity';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(DeviceAlert)
    private readonly alertRepo: Repository<DeviceAlert>,
  ) {}

  async getAlerts(organizationId: string, status?: string) {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('devices', 'd', 'd.id = a.device_id')
      .where('d.organization_id = :orgId', { orgId: organizationId });

    if (status) {
      qb.andWhere('a.status = :status', { status });
    }

    return qb
      .orderBy('a.triggered_at', 'DESC')
      .limit(200)
      .getRawMany();
  }

  async acknowledge(alertId: string): Promise<DeviceAlert> {
    const alert = await this.alertRepo.findOneOrFail({ where: { id: alertId } });
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async resolve(alertId: string): Promise<DeviceAlert> {
    const alert = await this.alertRepo.findOneOrFail({ where: { id: alertId } });
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    return this.alertRepo.save(alert);
  }
}
