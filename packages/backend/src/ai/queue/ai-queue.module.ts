import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AIQueueService } from './ai-queue.service';
import { AIQueueProcessor } from './ai-queue.processor';
import { AIModule } from '../ai.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'ai-processing',
            limiter: {
                max: 10, // Max 10 jobs per minute
                duration: 60000,
            },
        }),
        AIModule,
        PrismaModule,
    ],
    providers: [AIQueueService, AIQueueProcessor],
    exports: [AIQueueService],
})
export class AIQueueModule { }
