import {
  IsUUID,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class CpuMetrics {
  @IsNumber()
  @Min(0)
  @Max(100)
  usagePercent: number;

  @IsOptional()
  @IsNumber()
  temperatureCelsius?: number;

  @IsOptional()
  @IsNumber()
  frequencyMhz?: number;
}

class MemoryMetrics {
  @IsNumber()
  @Min(0)
  usedMb: number;

  @IsNumber()
  @Min(0)
  totalMb: number;
}

class StorageMetrics {
  @IsNumber()
  @Min(0)
  usedMb: number;

  @IsNumber()
  @Min(0)
  totalMb: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  healthPercent?: number;

  @IsOptional()
  @IsNumber()
  readErrors?: number;

  @IsOptional()
  @IsNumber()
  writeErrors?: number;
}

class NetworkMetrics {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  signalDbm?: number;

  @IsOptional()
  @IsNumber()
  bandwidthUpKbps?: number;

  @IsOptional()
  @IsNumber()
  bandwidthDownKbps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  packetLossPercent?: number;
}

class DisplayMetrics {
  @IsBoolean()
  connected: boolean;

  @IsOptional()
  @IsNumber()
  brightness?: number;
}

class SystemMetrics {
  @IsOptional()
  @IsNumber()
  uptimeSeconds?: number;

  @IsOptional()
  @IsNumber()
  processCount?: number;

  @IsOptional()
  @IsNumber()
  playerPid?: number;

  @IsOptional()
  @IsNumber()
  playerMemoryMb?: number;
}

export class TelemetryPayloadDto {
  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @ValidateNested()
  @Type(() => CpuMetrics)
  cpu: CpuMetrics;

  @ValidateNested()
  @Type(() => MemoryMetrics)
  memory: MemoryMetrics;

  @ValidateNested()
  @Type(() => StorageMetrics)
  storage: StorageMetrics;

  @IsOptional()
  @ValidateNested()
  @Type(() => NetworkMetrics)
  network?: NetworkMetrics;

  @IsOptional()
  @ValidateNested()
  @Type(() => DisplayMetrics)
  display?: DisplayMetrics;

  @IsOptional()
  @ValidateNested()
  @Type(() => SystemMetrics)
  system?: SystemMetrics;
}
