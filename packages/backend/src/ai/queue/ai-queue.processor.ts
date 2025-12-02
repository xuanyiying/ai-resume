import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AIEngine } from '../ai.engine';
import { PrismaService } from '@/prisma/prisma.service';
import { ParseStatus } from '@prisma/client';

@Processor('ai-processing')
export class AIQueueProcessor {
    private readonly logger = new Logger(AIQueueProcessor.name);

    constructor(
        private aiEngine: AIEngine,
        private prisma: PrismaService
    ) { }

    @Process('resume-parsing')
    async handleResumeParsing(job: Job<{ resumeId: string; userId: string; content: string }>) {
        const { resumeId, userId, content } = job.data;
        this.logger.log(`Processing resume parsing job for resume ${resumeId} (Job ID: ${job.id})`);

        try {
            // 1. Update status to PROCESSING (if not already)
            await this.prisma.resume.update({
                where: { id: resumeId },
                data: { parseStatus: ParseStatus.PROCESSING },
            });

            // 2. Call AI Engine
            const parsedData = await this.aiEngine.parseResumeContent(content);

            // 3. Update resume with results
            await this.prisma.resume.update({
                where: { id: resumeId },
                data: {
                    parsedData: parsedData as any,
                    parseStatus: ParseStatus.COMPLETED,
                },
            });

            this.logger.log(`Resume parsing completed for resume ${resumeId}`);
            return parsedData;
        } catch (error) {
            this.logger.error(`Failed to parse resume ${resumeId}:`, error);

            // Update status to FAILED
            await this.prisma.resume.update({
                where: { id: resumeId },
                data: { parseStatus: ParseStatus.FAILED },
            });

            throw error;
        }
    }
}
