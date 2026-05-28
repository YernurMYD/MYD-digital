import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';

@Controller('api/v1/telemetry')
export class TelemetryController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Эндпоинт для приёма телеметрии от устройств.
   * Аутентификация по device token (не JWT пользователя).
   */
  @Post('ingest')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(@Body() payload: TelemetryPayloadDto) {
    return this.telemetryService.ingest(payload);
  }

  /**
   * Batch-эндпоинт: приём пакета метрик от нескольких устройств
   * (для gateway-сценариев)
   */
  @Post('ingest/batch')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestBatch(@Body() payloads: TelemetryPayloadDto[]) {
    return this.telemetryService.ingestBatch(payloads);
  }

  @Get('device/:deviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  async getDeviceTelemetry(
    @Param('deviceId') deviceId: string,
    @Query() query: TelemetryQueryDto,
  ) {
    return this.telemetryService.getDeviceMetrics(deviceId, query);
  }

  @Get('device/:deviceId/latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  async getLatestTelemetry(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getLatestMetrics(deviceId);
  }

  @Get('dashboard/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  async getDashboardOverview(@Query('orgId') orgId: string) {
    return this.telemetryService.getFleetOverview(orgId);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  async getAlerts(
    @Query('orgId') orgId: string,
    @Query('status') status?: string,
  ) {
    return this.alertsService.getAlerts(orgId, status);
  }

  @Put('alerts/:alertId/acknowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  async acknowledgeAlert(@Param('alertId') alertId: string) {
    return this.alertsService.acknowledge(alertId);
  }
}
