import { Module } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { AIQueueModule } from '../ai/queue/ai-queue.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AIModule, StorageModule, AIQueueModule],
  providers: [ResumeService],
  controllers: [ResumeController],
  exports: [ResumeService],
})
export class ResumeModule {}
