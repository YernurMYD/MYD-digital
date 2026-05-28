import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ScreenStatus } from '../../common/enums/role.enum';

export class UpdateScreenDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt({ message: 'Количество слотов должно быть целым числом' })
  @Min(1, { message: 'Минимум 1 слот' })
  slotsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  occupiedSlots?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Стоимость — число с точностью до копеек' },
  )
  @Min(0, { message: 'Стоимость не может быть отрицательной' })
  monthlyCost?: number;

  @IsOptional()
  @IsEnum(ScreenStatus, { message: 'Некорректный статус экрана' })
  status?: ScreenStatus;
}
