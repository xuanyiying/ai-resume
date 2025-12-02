import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AIQueueService {
    private readonly logger = new Logger(AIQueueService.name);

    constructor(@InjectQueue('ai-processing') private aiQueue: Queue) { }

    /**
     * Add a resume parsing job to the queue
     */
    async addResumeParsingJob(resumeId: string, userId: string, content: string) {
        this.logger.log(`Adding resume parsing job for resume ${resumeId}`);
        return this.aiQueue.add(
            'resume-parsing',
            {
                resumeId,
                userId,
                content,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            }
        );
    }
}
