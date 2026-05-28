import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ScreenStatus } from '../../common/enums/role.enum';

export class CreateScreenDto {
  @IsString()
  @IsNotEmpty({ message: 'Название экрана обязательно' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Местоположение обязательно' })
  location: string;

  @IsInt({ message: 'Количество слотов должно быть целым числом' })
  @Min(1, { message: 'Минимум 1 слот' })
  slotsCount: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Стоимость — число с точностью до копеек' },
  )
  @Min(0, { message: 'Стоимость не может быть отрицательной' })
  monthlyCost: number;

  @IsOptional()
  @IsEnum(ScreenStatus, { message: 'Некорректный статус экрана' })
  status?: ScreenStatus;
}
