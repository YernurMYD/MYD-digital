import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PlaylistSchedulerService } from './playlist-scheduler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { EmergencyBroadcastDto } from './dto/emergency-broadcast.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';

@Controller('api/v1/campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly playlistScheduler: PlaylistSchedulerService,
  ) {}

  @Post()
  @Roles('admin', 'operator', 'agent', 'client')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCampaignDto, @CurrentUser() user: any) {
    return this.campaignsService.create(dto, user);
  }

  @Get()
  @Roles('admin', 'operator', 'agent', 'client')
  async findAll(@Query() query: CampaignQueryDto, @CurrentUser() user: any) {
    return this.campaignsService.findAll(query, user);
  }

  @Get(':id')
  @Roles('admin', 'operator', 'agent', 'client')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.campaignsService.findOne(id, user);
  }

  @Put(':id')
  @Roles('admin', 'operator', 'agent')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.campaignsService.remove(id, user);
  }

  @Post('emergency')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.CREATED)
  async emergencyBroadcast(
    @Body() dto: EmergencyBroadcastDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.triggerEmergency(dto, user);
  }

  @Post(':id/duplicate')
  @Roles('admin', 'operator', 'agent')
  async duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.campaignsService.duplicate(id, user);
  }

  @Get('device/:deviceId/playlist')
  @Roles('admin', 'operator')
  async getDevicePlaylist(
    @Param('deviceId') deviceId: string,
    @Query('date') date: string,
  ) {
    return this.playlistScheduler.getPlaylistForDevice(deviceId, date);
  }

  @Post('device/:deviceId/playlist/regenerate')
  @Roles('admin', 'operator')
  async regeneratePlaylist(@Param('deviceId') deviceId: string) {
    return this.playlistScheduler.regeneratePlaylist(deviceId);
  }
}
