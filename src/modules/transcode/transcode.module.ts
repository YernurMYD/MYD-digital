import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaFile } from '../campaigns/entities/media-file.entity';
import { FfprobeService } from './ffprobe.service';
import { TranscodeWorkerService } from './transcode-worker.service';

@Module({
  imports: [TypeOrmModule.forFeature([MediaFile])],
  providers: [FfprobeService, TranscodeWorkerService],
  exports: [FfprobeService, TranscodeWorkerService],
})
export class TranscodeModule {}
