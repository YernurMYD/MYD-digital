import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScreensController } from './screens.controller';
import { ScreensService } from './screens.service';
import { Screen } from './entities/screen.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Screen])],
  controllers: [ScreensController],
  providers: [ScreensService],
  exports: [ScreensService],
})
export class ScreensModule {}
