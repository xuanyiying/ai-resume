import { Test, TestingModule } from '@nestjs/testing';
import { AIQueueService } from './ai-queue.service';
import { getQueueToken } from '@nestjs/bull';

describe('AIQueueService', () => {
    let service: AIQueueService;
    let queueMock: { add: jest.Mock };

    beforeEach(async () => {
        queueMock = {
            add: jest.fn().mockResolvedValue({ id: 'job-id', finished: jest.fn() }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AIQueueService,
                {
                    provide: getQueueToken('ai-processing'),
                    useValue: queueMock,
                },
            ],
        }).compile();

        service = module.get<AIQueueService>(AIQueueService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should add resume parsing job to queue', async () => {
        const resumeId = 'resume-123';
        const userId = 'user-123';
        const content = 'Resume content';

        await service.addResumeParsingJob(resumeId, userId, content);

        expect(queueMock.add).toHaveBeenCalledWith(
            'resume-parsing',
            {
                resumeId,
                userId,
                content,
            },
            expect.any(Object)
        );
    });
});
