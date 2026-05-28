import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export enum TelemetryInterval {
  RAW = 'raw',
  HOURLY = 'hourly',
}

export class TelemetryQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsEnum(TelemetryInterval)
  interval?: TelemetryInterval = TelemetryInterval.RAW;
}
