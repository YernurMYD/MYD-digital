import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Campaign } from './entities/campaign.entity';
import { DevicePlaylist } from './entities/device-playlist.entity';
import { CampaignPriority, CampaignStatus } from './campaigns.types';

interface PlaylistEntry {
  campaignId: string;
  mediaFileId: string;
  storagePath: string;
  durationMs: number;
  priority: CampaignPriority;
  isEmergency: boolean;
  transition: string;
}

@Injectable()
export class PlaylistSchedulerService {
  private readonly logger = new Logger(PlaylistSchedulerService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(DevicePlaylist)
    private readonly playlistRepo: Repository<DevicePlaylist>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Генерирует плейлист для устройства на указанную дату.
   * Алгоритм очередности:
   * 1. Emergency кампании (наивысший приоритет, прерывают все)
   * 2. High-priority кампании
   * 3. Normal кампании (основной поток)
   * 4. Low-priority (заполнение пустот)
   *
   * Внутри каждого приоритета — сортировка по start_at (FIFO)
   */
  async generatePlaylist(deviceId: string, date: Date): Promise<DevicePlaylist> {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay() || 7;

    const campaigns = await this.campaignRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'items')
      .leftJoinAndSelect('items.mediaFile', 'media')
      .innerJoin('c.targets', 'targets')
      .where('targets.deviceId = :deviceId', { deviceId })
      .andWhere('c.status = :status', { status: CampaignStatus.ACTIVE })
      .andWhere('c.startAt <= :date', { date: targetDate })
      .andWhere('(c.endAt IS NULL OR c.endAt >= :date)', { date: targetDate })
      .andWhere(':dow = ANY(c.daysOfWeek)', { dow: dayOfWeek })
      .orderBy('c.priority', 'DESC')
      .addOrderBy('c.startAt', 'ASC')
      .addOrderBy('items.sortOrder', 'ASC')
      .getMany();

    const playlist = this.buildOrderedPlaylist(campaigns);

    const existing = await this.playlistRepo.findOne({
      where: { deviceId, generatedForDate: targetDate },
    });

    if (existing) {
      existing.playlistData = playlist;
      existing.version += 1;
      existing.generatedAt = new Date();
      return this.playlistRepo.save(existing);
    }

    const newPlaylist = this.playlistRepo.create({
      deviceId,
      generatedForDate: targetDate,
      playlistData: playlist,
    });

    return this.playlistRepo.save(newPlaylist);
  }

  private buildOrderedPlaylist(campaigns: Campaign[]): PlaylistEntry[] {
    const entries: PlaylistEntry[] = [];

    const grouped = {
      [CampaignPriority.EMERGENCY]: [] as Campaign[],
      [CampaignPriority.HIGH]: [] as Campaign[],
      [CampaignPriority.NORMAL]: [] as Campaign[],
      [CampaignPriority.LOW]: [] as Campaign[],
    };

    for (const campaign of campaigns) {
      grouped[campaign.priority].push(campaign);
    }

    const priorityOrder = [
      CampaignPriority.EMERGENCY,
      CampaignPriority.HIGH,
      CampaignPriority.NORMAL,
      CampaignPriority.LOW,
    ];

    for (const priority of priorityOrder) {
      for (const campaign of grouped[priority]) {
        for (const item of campaign.items ?? []) {
          entries.push({
            campaignId: campaign.id,
            mediaFileId: item.mediaFileId,
            storagePath: item.mediaFile?.storagePath ?? '',
            durationMs: item.durationOverrideMs ?? item.mediaFile?.durationMs ?? 15000,
            priority: campaign.priority,
            isEmergency: campaign.isEmergency,
            transition: item.transitionType ?? 'crossfade',
          });
        }
      }
    }

    return entries;
  }

  async getPlaylistForDevice(deviceId: string, date?: string): Promise<DevicePlaylist> {
    const targetDate = date ? new Date(date) : new Date();

    let playlist = await this.playlistRepo.findOne({
      where: { deviceId, generatedForDate: targetDate },
    });

    if (!playlist) {
      playlist = await this.generatePlaylist(deviceId, targetDate);
    }

    return playlist;
  }

  async regeneratePlaylist(deviceId: string): Promise<DevicePlaylist> {
    const playlist = await this.generatePlaylist(deviceId, new Date());

    this.eventEmitter.emit('playlist.updated', { deviceId, version: playlist.version });

    return playlist;
  }

  @OnEvent('campaign.emergency')
  async handleEmergencyBroadcast(payload: {
    campaignId: string;
    deviceIds: string[];
    expiresAt: Date;
  }) {
    this.logger.warn(
      `Emergency broadcast triggered: campaign=${payload.campaignId}, devices=${payload.deviceIds.length}`,
    );

    for (const deviceId of payload.deviceIds) {
      await this.regeneratePlaylist(deviceId);

      this.eventEmitter.emit('device.command', {
        deviceId,
        command: 'emergency_interrupt',
        payload: { campaignId: payload.campaignId, expiresAt: payload.expiresAt },
      });
    }
  }

  @OnEvent('campaign.updated')
  async handleCampaignUpdate(payload: { campaignId: string }) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: payload.campaignId },
      relations: ['targets'],
    });

    if (!campaign) return;

    for (const target of campaign.targets ?? []) {
      if (target.deviceId) {
        await this.regeneratePlaylist(target.deviceId);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateDailyPlaylists() {
    this.logger.log('Starting daily playlist generation...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const devices = await this.campaignRepo.query(
      `SELECT DISTINCT d.id FROM devices d WHERE d.is_online = true`,
    );

    let generated = 0;
    for (const device of devices) {
      await this.generatePlaylist(device.id, tomorrow);
      generated++;
    }

    this.logger.log(`Generated playlists for ${generated} devices`);
  }
}
