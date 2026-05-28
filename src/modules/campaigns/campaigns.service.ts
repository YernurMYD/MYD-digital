import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Campaign } from './entities/campaign.entity';
import { CampaignItem } from './entities/campaign-item.entity';
import { CampaignDeviceTarget } from './entities/campaign-device-target.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { EmergencyBroadcastDto } from './dto/emergency-broadcast.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { CampaignPriority, CampaignStatus } from './campaigns.types';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignItem)
    private readonly itemRepo: Repository<CampaignItem>,
    @InjectRepository(CampaignDeviceTarget)
    private readonly targetRepo: Repository<CampaignDeviceTarget>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCampaignDto, user: any): Promise<Campaign> {
    const campaign = this.campaignRepo.create({
      ...dto,
      organizationId: user.organizationId,
      createdBy: user.id,
      status: CampaignStatus.DRAFT,
    });

    const saved = await this.campaignRepo.save(campaign);

    if (dto.items?.length) {
      const items = dto.items.map((item, index) =>
        this.itemRepo.create({
          campaignId: saved.id,
          mediaFileId: item.mediaFileId,
          sortOrder: item.sortOrder ?? index,
          durationOverrideMs: item.durationOverrideMs,
          transitionType: item.transitionType ?? 'crossfade',
        }),
      );
      await this.itemRepo.save(items);
    }

    if (dto.targetDeviceIds?.length) {
      const targets = dto.targetDeviceIds.map((deviceId) =>
        this.targetRepo.create({ campaignId: saved.id, deviceId }),
      );
      await this.targetRepo.save(targets);
    }

    if (dto.targetGroupIds?.length) {
      const groupTargets = dto.targetGroupIds.map((deviceGroupId) =>
        this.targetRepo.create({ campaignId: saved.id, deviceGroupId }),
      );
      await this.targetRepo.save(groupTargets);
    }

    return this.findOne(saved.id, user);
  }

  async findAll(query: CampaignQueryDto, user: any) {
    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'items')
      .leftJoinAndSelect('c.targets', 'targets')
      .where('c.organizationId = :orgId', { orgId: user.organizationId });

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('c.priority = :priority', { priority: query.priority });
    }

    if (query.search) {
      qb.andWhere('c.name ILIKE :search', { search: `%${query.search}%` });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    qb.orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, user: any): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['items', 'items.mediaFile', 'targets'],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, user: any): Promise<Campaign> {
    const campaign = await this.findOne(id, user);

    Object.assign(campaign, dto);
    await this.campaignRepo.save(campaign);

    if (campaign.status === CampaignStatus.ACTIVE) {
      this.eventEmitter.emit('campaign.updated', { campaignId: id });
    }

    return this.findOne(id, user);
  }

  async remove(id: string, user: any): Promise<void> {
    const campaign = await this.findOne(id, user);

    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new ForbiddenException('Cannot delete an active campaign. Pause it first.');
    }

    await this.campaignRepo.softRemove(campaign);
  }

  async triggerEmergency(dto: EmergencyBroadcastDto, user: any): Promise<Campaign> {
    const campaign = this.campaignRepo.create({
      name: `[EMERGENCY] ${dto.name}`,
      organizationId: user.organizationId,
      createdBy: user.id,
      status: CampaignStatus.ACTIVE,
      priority: CampaignPriority.EMERGENCY,
      isEmergency: true,
      emergencyExpiresAt: dto.expiresAt,
      startAt: new Date(),
      endAt: dto.expiresAt,
    });

    const saved = await this.campaignRepo.save(campaign);

    if (dto.mediaFileId) {
      const item = this.itemRepo.create({
        campaignId: saved.id,
        mediaFileId: dto.mediaFileId,
        sortOrder: 0,
      });
      await this.itemRepo.save(item);
    }

    const targets = dto.targetDeviceIds.map((deviceId) =>
      this.targetRepo.create({ campaignId: saved.id, deviceId }),
    );
    await this.targetRepo.save(targets);

    this.eventEmitter.emit('campaign.emergency', {
      campaignId: saved.id,
      deviceIds: dto.targetDeviceIds,
      expiresAt: dto.expiresAt,
    });

    return this.findOne(saved.id, user);
  }

  async duplicate(id: string, user: any): Promise<Campaign> {
    const original = await this.findOne(id, user);

    const clone = this.campaignRepo.create({
      ...original,
      id: undefined,
      name: `${original.name} (копия)`,
      status: CampaignStatus.DRAFT,
      createdBy: user.id,
      createdAt: undefined,
      updatedAt: undefined,
    });

    const saved = await this.campaignRepo.save(clone);

    if (original.items?.length) {
      const items = original.items.map((item) =>
        this.itemRepo.create({
          campaignId: saved.id,
          mediaFileId: item.mediaFileId,
          sortOrder: item.sortOrder,
          durationOverrideMs: item.durationOverrideMs,
          transitionType: item.transitionType,
        }),
      );
      await this.itemRepo.save(items);
    }

    return this.findOne(saved.id, user);
  }
}
