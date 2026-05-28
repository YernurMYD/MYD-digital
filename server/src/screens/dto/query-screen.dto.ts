import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ScreenStatus } from '../../common/enums/role.enum';

export class QueryScreenDto {
  @IsOptional()
  @IsEnum(ScreenStatus)
  status?: ScreenStatus;

  @IsOptional()
  @IsString()
  location?: string;
}
