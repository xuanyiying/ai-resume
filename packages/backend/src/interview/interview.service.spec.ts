import { Test, TestingModule } from '@nestjs/testing';
import { InterviewService } from './interview.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIEngine } from '../ai/ai.engine';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  QuestionType,
  Difficulty,
  InterviewStatus,
  MessageRole,
} from '@prisma/client';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EndSessionDto } from './dto/end-session.dto';

describe('InterviewService', () => {
  let service: InterviewService;
  let prismaService: PrismaService;
  let aiEngine: AIEngine;

  const mockUserId = 'user-123';
  const mockOptimizationId = 'opt-123';
  const mockResumeId = 'resume-123';
  const mockJobId = 'job-123';

  const mockResumeData = {
    personalInfo: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      location: 'San Francisco, CA',
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
    },
    summary: 'Experienced software engineer',
    education: [
      {
        institution: 'MIT',
        degree: 'Bachelor',
        field: 'Computer Science',
        startDate: '2015',
        endDate: '2019',
        gpa: '3.8',
        achievements: ["Dean's List"],
      },
    ],
    experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Engineer',
        startDate: '2020',
        endDate: '2023',
        location: 'San Francisco, CA',
        description: ['Led team of 5 engineers', 'Improved performance by 40%'],
        achievements: ['Shipped major feature', 'Mentored 3 junior engineers'],
      },
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    projects: [
      {
        name: 'E-commerce Platform',
        description: 'Built scalable e-commerce platform',
        technologies: ['React', 'Node.js', 'PostgreSQL'],
        startDate: '2021',
        endDate: '2022',
        url: 'https://example.com',
        highlights: ['Handled 1M+ transactions', 'Reduced load time by 50%'],
      },
    ],
  };

  const mockJobData = {
    requiredSkills: ['JavaScript', 'React', 'Node.js'],
    preferredSkills: ['TypeScript', 'PostgreSQL'],
    experienceYears: 3,
    educationLevel: 'Bachelor',
    responsibilities: ['Build web applications', 'Mentor junior developers'],
    keywords: ['React', 'Node.js', 'REST API'],
  };

  const mockOptimization = {
    id: mockOptimizationId,
    userId: mockUserId,
    resumeId: mockResumeId,
    jobId: mockJobId,
    matchScore: null,
    suggestions: [],
    optimizedContent: null,
    status: 'PENDING',
    createdAt: new Date(),
    completedAt: null,
    resume: {
      id: mockResumeId,
      userId: mockUserId,
      title: 'My Resume',
      originalFilename: 'resume.pdf',
      fileUrl: 'https://example.com/resume.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      parsedData: mockResumeData,
      version: 1,
      isPrimary: true,
      parseStatus: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    job: {
      id: mockJobId,
      userId: mockUserId,
      title: 'Senior Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      jobType: 'Full-time',
      salaryRange: '$150k-$200k',
      jobDescription: 'We are looking for a senior engineer...',
      requirements: 'Must have 3+ years of experience',
      parsedRequirements: mockJobData,
      sourceUrl: 'https://example.com/job',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        {
          provide: PrismaService,
          useValue: {
            optimization: {
              findUnique: jest.fn(),
            },
            interviewQuestion: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            interviewSession: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            interviewMessage: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: AIEngine,
          useValue: {
            generateInterviewQuestions: jest.fn(),
            chatWithInterviewer: jest.fn(),
            generate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InterviewService>(InterviewService);
    prismaService = module.get<PrismaService>(PrismaService);
    aiEngine = module.get<AIEngine>(AIEngine);
  });

  describe('generateQuestions', () => {
    it('should generate interview questions successfully', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.BEHAVIORAL,
          question: 'Tell me about a challenge you overcame',
          suggestedAnswer: 'I faced a challenge...',
          tips: ['Use STAR method'],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest.spyOn(aiEngine, 'generateInterviewQuestions').mockResolvedValue([]);

      jest
        .spyOn(prismaService.interviewQuestion, 'create')
        .mockResolvedValue(mockQuestions[0] as any);

      const result = await service.generateQuestions(
        mockOptimizationId,
        mockUserId,
        10
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.optimization.findUnique).toHaveBeenCalledWith({
        where: { id: mockOptimizationId },
        include: {
          resume: true,
          job: true,
        },
      });
    });

    it('should throw NotFoundException if optimization not found', async () => {
      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.generateQuestions(mockOptimizationId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own optimization', async () => {
      const otherUserOptimization = {
        ...mockOptimization,
        userId: 'other-user',
      };

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(otherUserOptimization as any);

      await expect(
        service.generateQuestions(mockOptimizationId, mockUserId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should ensure question count is between 10 and 15', async () => {
      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest.spyOn(aiEngine, 'generateInterviewQuestions').mockResolvedValue([]);

      jest.spyOn(prismaService.interviewQuestion, 'create').mockResolvedValue({
        id: 'q1',
        optimizationId: mockOptimizationId,
        questionType: QuestionType.BEHAVIORAL,
        question: 'Test question',
        suggestedAnswer: 'Test answer',
        tips: [],
        difficulty: Difficulty.MEDIUM,
        createdAt: new Date(),
      } as any);

      // Test with count < 10
      const result1 = await service.generateQuestions(
        mockOptimizationId,
        mockUserId,
        5
      );
      expect(result1.length).toBeGreaterThanOrEqual(10);

      // Test with count > 15
      const result2 = await service.generateQuestions(
        mockOptimizationId,
        mockUserId,
        20
      );
      expect(result2.length).toBeLessThanOrEqual(15);
    });
  });

  describe('getQuestions', () => {
    it('should retrieve interview questions for an optimization', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.BEHAVIORAL,
          question: 'Test question',
          suggestedAnswer: 'Test answer',
          tips: [],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest
        .spyOn(prismaService.interviewQuestion, 'findMany')
        .mockResolvedValue(mockQuestions as any);

      const result = await service.getQuestions(mockOptimizationId, mockUserId);

      expect(result).toEqual(mockQuestions);
      expect(prismaService.interviewQuestion.findMany).toHaveBeenCalledWith({
        where: { optimizationId: mockOptimizationId },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw NotFoundException if optimization not found', async () => {
      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.getQuestions(mockOptimizationId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own optimization', async () => {
      const otherUserOptimization = {
        ...mockOptimization,
        userId: 'other-user',
      };

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(otherUserOptimization as any);

      await expect(
        service.getQuestions(mockOptimizationId, mockUserId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportInterviewPrep', () => {
    it('should export interview preparation as HTML', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.BEHAVIORAL,
          question: 'Tell me about a challenge',
          suggestedAnswer: 'I faced a challenge...',
          tips: ['Use STAR method'],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
        {
          id: 'q2',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.TECHNICAL,
          question: 'Explain your experience with React',
          suggestedAnswer: 'I have 5 years of React experience...',
          tips: ['Be specific'],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest
        .spyOn(prismaService.interviewQuestion, 'findMany')
        .mockResolvedValue(mockQuestions as any);

      const result = await service.exportInterviewPrep(
        mockOptimizationId,
        mockUserId
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Interview Preparation Guide');
      expect(result).toContain('Tell me about a challenge');
      expect(result).toContain('Explain your experience with React');
    });

    it('should throw NotFoundException if no questions found', async () => {
      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest
        .spyOn(prismaService.interviewQuestion, 'findMany')
        .mockResolvedValue([]);

      await expect(
        service.exportInterviewPrep(mockOptimizationId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Question generation by type', () => {
    it('should generate behavioral questions with STAR method', () => {
      const questions = (service as any).generateBehavioralQuestions(
        mockResumeData,
        2
      );

      expect(questions.length).toBeGreaterThanOrEqual(2);
      expect(questions[0].questionType).toBe(QuestionType.BEHAVIORAL);
      expect(questions[0].suggestedAnswer).toContain('STAR');
      expect(questions[0].tips).toBeDefined();
      expect(Array.isArray(questions[0].tips)).toBe(true);
    });

    it('should generate technical questions', () => {
      const questions = (service as any).generateTechnicalQuestions(
        mockJobData,
        2
      );

      expect(questions.length).toBeGreaterThanOrEqual(2);
      expect(questions[0].questionType).toBe(QuestionType.TECHNICAL);
      expect(questions[0].tips).toBeDefined();
    });

    it('should generate situational questions', () => {
      const questions = (service as any).generateSituationalQuestions(
        mockJobData,
        2
      );

      expect(questions.length).toBeGreaterThanOrEqual(2);
      expect(questions[0].questionType).toBe(QuestionType.SITUATIONAL);
      expect(questions[0].tips).toBeDefined();
    });

    it('should generate resume-based questions', () => {
      const questions = (service as any).generateResumeBasedQuestions(
        mockResumeData,
        2
      );

      expect(questions.length).toBeGreaterThanOrEqual(2);
      expect(questions[0].questionType).toBe(QuestionType.RESUME_BASED);
      expect(questions[0].tips).toBeDefined();
    });
  });

  describe('Question type distribution', () => {
    it('should generate questions with all four types', async () => {
      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest.spyOn(aiEngine, 'generateInterviewQuestions').mockResolvedValue([]);

      // Create mock questions with all types
      const mockQuestions = [
        {
          id: 'q1',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.BEHAVIORAL,
          question: 'Behavioral question',
          suggestedAnswer: 'Answer',
          tips: [],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
        {
          id: 'q2',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.TECHNICAL,
          question: 'Technical question',
          suggestedAnswer: 'Answer',
          tips: [],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
        {
          id: 'q3',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.SITUATIONAL,
          question: 'Situational question',
          suggestedAnswer: 'Answer',
          tips: [],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
        {
          id: 'q4',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.RESUME_BASED,
          question: 'Resume-based question',
          suggestedAnswer: 'Answer',
          tips: [],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prismaService.interviewQuestion, 'create')
        .mockResolvedValueOnce(mockQuestions[0] as any)
        .mockResolvedValueOnce(mockQuestions[1] as any)
        .mockResolvedValueOnce(mockQuestions[2] as any)
        .mockResolvedValueOnce(mockQuestions[3] as any)
        .mockResolvedValueOnce(mockQuestions[0] as any)
        .mockResolvedValueOnce(mockQuestions[1] as any)
        .mockResolvedValueOnce(mockQuestions[2] as any)
        .mockResolvedValueOnce(mockQuestions[3] as any)
        .mockResolvedValueOnce(mockQuestions[0] as any)
        .mockResolvedValueOnce(mockQuestions[1] as any)
        .mockResolvedValueOnce(mockQuestions[2] as any)
        .mockResolvedValueOnce(mockQuestions[3] as any);

      const result = await service.generateQuestions(
        mockOptimizationId,
        mockUserId,
        12
      );

      const types = result.map((q) => q.questionType);
      expect(types).toContain(QuestionType.BEHAVIORAL);
      expect(types).toContain(QuestionType.TECHNICAL);
      expect(types).toContain(QuestionType.SITUATIONAL);
      expect(types).toContain(QuestionType.RESUME_BASED);
    });
  });

  describe('Question metadata completeness', () => {
    it('should include all required metadata in questions', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          optimizationId: mockOptimizationId,
          questionType: QuestionType.BEHAVIORAL,
          question: 'Test question',
          suggestedAnswer: 'Test answer',
          tips: ['Tip 1', 'Tip 2'],
          difficulty: Difficulty.MEDIUM,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest.spyOn(aiEngine, 'generateInterviewQuestions').mockResolvedValue([]);

      jest
        .spyOn(prismaService.interviewQuestion, 'create')
        .mockResolvedValue(mockQuestions[0] as any);

      const result = await service.generateQuestions(
        mockOptimizationId,
        mockUserId,
        10
      );

      result.forEach((question) => {
        expect(question.questionType).toBeDefined();
        expect(question.question).toBeDefined();
        expect(question.suggestedAnswer).toBeDefined();
        expect(question.tips).toBeDefined();
        expect(Array.isArray(question.tips)).toBe(true);
        expect(question.difficulty).toBeDefined();
      });
    });
  });
  describe('startSession', () => {
    it('should start a new interview session', async () => {
      const createSessionDto: CreateSessionDto = {
        optimizationId: mockOptimizationId,
      };
      const mockSession = {
        id: 'session-123',
        userId: mockUserId,
        optimizationId: mockOptimizationId,
        status: InterviewStatus.IN_PROGRESS,
        createdAt: new Date(),
      };

      jest
        .spyOn(prismaService.optimization, 'findUnique')
        .mockResolvedValue(mockOptimization as any);

      jest
        .spyOn(prismaService.interviewSession, 'create')
        .mockResolvedValue(mockSession as any);

      const result = await service.startSession(mockUserId, createSessionDto);

      expect(result).toEqual(mockSession);
      expect(prismaService.interviewSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          optimizationId: mockOptimizationId,
          status: InterviewStatus.IN_PROGRESS,
        },
      });
    });
  });

  describe('handleMessage', () => {
    it('should handle user message and generate AI response', async () => {
      const sessionId = 'session-123';
      const sendMessageDto: SendMessageDto = { content: 'Hello' };
      const mockSession = {
        id: sessionId,
        userId: mockUserId,
        status: InterviewStatus.IN_PROGRESS,
        optimization: mockOptimization,
        messages: [],
      };

      const mockUserMessage = {
        id: 'msg-1',
        sessionId,
        role: MessageRole.USER,
        content: 'Hello',
        createdAt: new Date(),
      };

      const mockAiResponse = {
        content: 'Hi there',
        audioUrl: 'http://example.com/audio.mp3',
      };

      const mockAiMessage = {
        id: 'msg-2',
        sessionId,
        role: MessageRole.ASSISTANT,
        content: 'Hi there',
        audioUrl: 'http://example.com/audio.mp3',
        createdAt: new Date(),
      };

      jest
        .spyOn(prismaService.interviewSession, 'findUnique')
        .mockResolvedValue(mockSession as any);

      jest
        .spyOn(prismaService.interviewMessage, 'create')
        .mockResolvedValueOnce(mockUserMessage as any)
        .mockResolvedValueOnce(mockAiMessage as any);

      jest
        .spyOn(aiEngine, 'chatWithInterviewer')
        .mockResolvedValue(mockAiResponse);

      const result = await service.handleMessage(
        mockUserId,
        sessionId,
        sendMessageDto
      );

      expect(result.userMessage).toEqual(mockUserMessage);
      expect(result.aiMessage).toEqual(mockAiMessage);
      expect(aiEngine.chatWithInterviewer).toHaveBeenCalled();
    });
  });

  describe('endSession', () => {
    it('should end interview session and trigger feedback generation', async () => {
      const sessionId = 'session-123';
      const endSessionDto: EndSessionDto = { sessionId };
      const mockSession = {
        id: sessionId,
        userId: mockUserId,
        status: InterviewStatus.IN_PROGRESS,
      };

      const mockCompletedSession = {
        ...mockSession,
        status: InterviewStatus.COMPLETED,
        endTime: new Date(),
        messages: [],
        optimization: mockOptimization,
      };

      jest
        .spyOn(prismaService.interviewSession, 'findUnique')
        .mockResolvedValue(mockSession as any);

      jest
        .spyOn(prismaService.interviewSession, 'update')
        .mockResolvedValue(mockCompletedSession as any);

      jest.spyOn(aiEngine, 'generate').mockResolvedValue(
        JSON.stringify({
          score: 85,
          feedback: 'Good job',
        })
      );

      const result = await service.endSession(mockUserId, endSessionDto);

      expect(result).toEqual(mockCompletedSession);
      expect(prismaService.interviewSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sessionId },
          data: expect.objectContaining({
            status: InterviewStatus.COMPLETED,
          }),
        })
      );
    });
  });
});
