import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsUUID,
  IsBoolean,
  IsNumber,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignPriority } from '../campaigns.types';

export class CampaignItemDto {
  @IsUUID()
  mediaFileId: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  durationOverrideMs?: number;

  @IsOptional()
  @IsString()
  transitionType?: string;
}

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CampaignPriority)
  priority?: CampaignPriority;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  dailyStartTime?: string;

  @IsOptional()
  @IsString()
  dailyEndTime?: string;

  @IsOptional()
  @IsArray()
  daysOfWeek?: number[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  repeatIntervalMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxImpressionsPerDay?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignItemDto)
  items?: CampaignItemDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetDeviceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetGroupIds?: string[];
}
