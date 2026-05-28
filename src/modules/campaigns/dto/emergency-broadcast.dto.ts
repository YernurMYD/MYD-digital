import {
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';

export class EmergencyBroadcastDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  mediaFileId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  targetDeviceIds: string[];

  @IsDateString()
  expiresAt: Date;
}
