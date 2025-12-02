import { Test, TestingModule } from '@nestjs/testing';
import { OptimizationService, MatchScore } from './optimization.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIEngine } from '../ai/ai.engine';
import { QuotaService } from '../quota/quota.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fc from 'fast-check';
import { ParsedJobData, ParsedResumeData } from '@/types';

describe('OptimizationService', () => {
  let service: OptimizationService;

  const mockPrismaService = {
    resume: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    optimization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAIEngine = {
    generateOptimizationSuggestions: jest.fn(),
  };

  const mockQuotaService = {
    enforceOptimizationQuota: jest.fn(),
    incrementOptimizationCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AIEngine,
          useValue: mockAIEngine,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
      ],
    }).compile();

    service = module.get<OptimizationService>(OptimizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateMatchScore', () => {
    // **Feature: resume-optimizer-mvp, Property 8: 匹配度评分范围**
    it('should return match score between 0 and 100', () => {
      const resumeDataArbitrary = fc.record({
        personalInfo: fc.record({
          name: fc.string(),
          email: fc.emailAddress(),
        }),
        education: fc.array(
          fc.record({
            institution: fc.string(),
            degree: fc.string(),
            field: fc.string(),
            startDate: fc.string(),
          })
        ),
        experience: fc.array(
          fc.record({
            company: fc.string(),
            position: fc.string(),
            startDate: fc.string(),
            description: fc.array(fc.string()),
          })
        ),
        skills: fc.array(fc.string()),
        projects: fc.array(
          fc.record({
            name: fc.string(),
            description: fc.string(),
            technologies: fc.array(fc.string()),
            highlights: fc.array(fc.string()),
          })
        ),
      });

      const jobDataArbitrary = fc.record({
        requiredSkills: fc.array(fc.string()),
        preferredSkills: fc.array(fc.string()),
        responsibilities: fc.array(fc.string()),
        keywords: fc.array(fc.string()),
      });

      fc.assert(
        fc.property(
          resumeDataArbitrary,
          jobDataArbitrary,
          (resumeData: any, jobData: any) => {
            const matchScore: MatchScore = service.calculateMatchScore(
              resumeData as ParsedResumeData,
              jobData as ParsedJobData
            );

            expect(matchScore.overall).toBeGreaterThanOrEqual(0);
            expect(matchScore.overall).toBeLessThanOrEqual(100);
            expect(matchScore.skiAIatch).toBeGreaterThanOrEqual(0);
            expect(matchScore.skiAIatch).toBeLessThanOrEqual(100);
            expect(matchScore.experienceMatch).toBeGreaterThanOrEqual(0);
            expect(matchScore.experienceMatch).toBeLessThanOrEqual(100);
            expect(matchScore.educationMatch).toBeGreaterThanOrEqual(0);
            expect(matchScore.educationMatch).toBeLessThanOrEqual(100);
            expect(matchScore.keywordCoverage).toBeGreaterThanOrEqual(0);
            expect(matchScore.keywordCoverage).toBeLessThanOrEqual(100);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: resume-optimizer-mvp, Property 9: 匹配度子项完整性**
    it('should include all required match score components', () => {
      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [
          {
            institution: 'MIT',
            degree: 'Bachelor',
            field: 'Computer Science',
            startDate: '2015',
          },
        ],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Developed features'],
          },
        ],
        skills: ['JavaScript', 'TypeScript', 'React'],
        projects: [],
      };

      const jobData: ParsedJobData = {
        requiredSkills: ['JavaScript', 'React'],
        preferredSkills: ['TypeScript'],
        responsibilities: ['Build features'],
        keywords: ['JavaScript', 'React'],
      };

      const matchScore = service.calculateMatchScore(resumeData, jobData);

      expect(matchScore).toHaveProperty('overall');
      expect(matchScore).toHaveProperty('skiAIatch');
      expect(matchScore).toHaveProperty('experienceMatch');
      expect(matchScore).toHaveProperty('educationMatch');
      expect(matchScore).toHaveProperty('keywordCoverage');
      expect(matchScore).toHaveProperty('strengths');
      expect(matchScore).toHaveProperty('weaknesses');
      expect(matchScore).toHaveProperty('missingKeywords');
    });
  });

  describe('createOptimization', () => {
    it('should create optimization record when user owns both resume and job', async () => {
      const userId = 'user-123';
      const resumeId = 'resume-123';
      const jobId = 'job-123';

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
      });

      mockPrismaService.job.findUnique.mockResolvedValue({
        id: jobId,
        userId,
      });

      mockPrismaService.optimization.create.mockResolvedValue({
        id: 'opt-123',
        userId,
        resumeId,
        jobId,
        status: 'PENDING',
      });

      const result = await service.createOptimization(userId, resumeId, jobId);

      expect(result.id).toBe('opt-123');
      expect(mockPrismaService.optimization.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own resume', async () => {
      const userId = 'user-123';
      const resumeId = 'resume-123';
      const jobId = 'job-123';

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId: 'different-user',
      });

      await expect(
        service.createOptimization(userId, resumeId, jobId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user does not own job', async () => {
      const userId = 'user-123';
      const resumeId = 'resume-123';
      const jobId = 'job-123';

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
      });

      mockPrismaService.job.findUnique.mockResolvedValue({
        id: jobId,
        userId: 'different-user',
      });

      await expect(
        service.createOptimization(userId, resumeId, jobId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOptimization', () => {
    it('should return optimization when user owns it', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
      });

      const result = await service.getOptimization(optimizationId, userId);

      expect(result.id).toBe(optimizationId);
    });

    it('should throw NotFoundException when optimization does not exist', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue(null);

      await expect(
        service.getOptimization('non-existent', 'user-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own optimization', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: 'opt-123',
        userId: 'different-user',
      });

      await expect(
        service.getOptimization('opt-123', 'user-123')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listOptimizations', () => {
    it('should return all optimizations for a user ordered by creation date', async () => {
      const userId = 'user-123';
      const optimizations = [
        { id: 'opt-1', userId, createdAt: new Date('2024-01-03') },
        { id: 'opt-2', userId, createdAt: new Date('2024-01-02') },
        { id: 'opt-3', userId, createdAt: new Date('2024-01-01') },
      ];

      mockPrismaService.optimization.findMany.mockResolvedValue(optimizations);

      const result = await service.listOptimizations(userId);

      expect(result).toHaveLength(3);
      expect(mockPrismaService.optimization.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no optimizations', async () => {
      const userId = 'user-123';

      mockPrismaService.optimization.findMany.mockResolvedValue([]);

      const result = await service.listOptimizations(userId);

      expect(result).toHaveLength(0);
    });
  });

  describe('listOptimizationsByResume', () => {
    it('should return optimizations for a specific resume', async () => {
      const userId = 'user-123';
      const resumeId = 'resume-123';
      const optimizations = [
        { id: 'opt-1', userId, resumeId, createdAt: new Date('2024-01-02') },
        { id: 'opt-2', userId, resumeId, createdAt: new Date('2024-01-01') },
      ];

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
      });

      mockPrismaService.optimization.findMany.mockResolvedValue(optimizations);

      const result = await service.listOptimizationsByResume(userId, resumeId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.optimization.findMany).toHaveBeenCalledWith({
        where: { userId, resumeId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw ForbiddenException when user does not own resume', async () => {
      const userId = 'user-123';
      const resumeId = 'resume-123';

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId: 'different-user',
      });

      await expect(
        service.listOptimizationsByResume(userId, resumeId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listOptimizationsByJob', () => {
    it('should return optimizations for a specific job', async () => {
      const userId = 'user-123';
      const jobId = 'job-123';
      const optimizations = [
        { id: 'opt-1', userId, jobId, createdAt: new Date('2024-01-02') },
        { id: 'opt-2', userId, jobId, createdAt: new Date('2024-01-01') },
      ];

      mockPrismaService.job.findUnique.mockResolvedValue({
        id: jobId,
        userId,
      });

      mockPrismaService.optimization.findMany.mockResolvedValue(optimizations);

      const result = await service.listOptimizationsByJob(userId, jobId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.optimization.findMany).toHaveBeenCalledWith({
        where: { userId, jobId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw ForbiddenException when user does not own job', async () => {
      const userId = 'user-123';
      const jobId = 'job-123';

      mockPrismaService.job.findUnique.mockResolvedValue({
        id: jobId,
        userId: 'different-user',
      });

      await expect(
        service.listOptimizationsByJob(userId, jobId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('applySuggestion', () => {
    it('should update suggestion status to ACCEPTED and create new resume version', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';
      const resumeId = 'resume-123';
      const suggestionId = 'sug-123';

      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Worked on features'],
          },
        ],
        skills: [],
        projects: [],
      };

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
        resumeId,
        suggestions: [
          {
            id: suggestionId,
            status: 'PENDING',
            section: 'experience',
            itemIndex: 0,
            original: 'Worked on features',
            optimized: 'Developed and implemented new features',
            type: 'content',
          },
        ],
      });

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
        version: 1,
        parsedData: resumeData,
      });

      mockPrismaService.resume.update.mockResolvedValue({
        id: resumeId,
        userId,
        version: 2,
        parsedData: {
          ...resumeData,
          experience: [
            {
              ...resumeData.experience[0],
              description: ['Developed and implemented new features'],
            },
          ],
        },
      });

      mockPrismaService.optimization.update.mockResolvedValue({
        id: optimizationId,
        userId,
        suggestions: [
          {
            id: suggestionId,
            status: 'ACCEPTED',
          },
        ],
      });

      const result = await service.applySuggestion(
        optimizationId,
        userId,
        suggestionId
      );

      expect(mockPrismaService.resume.update).toHaveBeenCalledWith({
        where: { id: resumeId },
        data: expect.objectContaining({
          version: 2,
        }),
      });
      expect(result).toHaveBeenCalled();
      expect(mockPrismaService.optimization.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when suggestion does not exist', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
        suggestions: [],
      });

      await expect(
        service.applySuggestion(optimizationId, userId, 'non-existent')
      ).rejects.toThrow(NotFoundException);
    });

    // **Feature: resume-optimizer-mvp, Property 14: 建议接受后内容更新**
    it('should update resume content when suggestion is accepted', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';
      const resumeId = 'resume-123';
      const suggestionId = 'sug-123';

      const originalDescription = 'Worked on backend systems';
      const optimizedDescription =
        'Developed and optimized backend systems resulting in 40% performance improvement';

      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: [originalDescription],
          },
        ],
        skills: [],
        projects: [],
      };

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
        resumeId,
        suggestions: [
          {
            id: suggestionId,
            status: 'PENDING',
            section: 'experience',
            itemIndex: 0,
            original: originalDescription,
            optimized: optimizedDescription,
            type: 'content',
          },
        ],
      });

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
        version: 1,
        parsedData: resumeData,
      });

      mockPrismaService.resume.update.mockResolvedValue({
        id: resumeId,
        userId,
        version: 2,
        parsedData: {
          ...resumeData,
          experience: [
            {
              ...resumeData.experience[0],
              description: [optimizedDescription],
            },
          ],
        },
      });

      mockPrismaService.optimization.update.mockResolvedValue({
        id: optimizationId,
        userId,
        suggestions: [
          {
            id: suggestionId,
            status: 'ACCEPTED',
          },
        ],
      });

      await service.applySuggestion(optimizationId, userId, suggestionId);

      // Verify that resume was updated with new version
      expect(mockPrismaService.resume.update).toHaveBeenCalledWith({
        where: { id: resumeId },
        data: expect.objectContaining({
          version: 2,
        }),
      });
    });
  });

  describe('applyBatchSuggestions', () => {
    it('should apply multiple suggestions and create new resume version', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';
      const resumeId = 'resume-123';
      const suggestionIds = ['sug-1', 'sug-2'];

      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Worked on features', 'Managed team'],
          },
        ],
        skills: ['JavaScript'],
        projects: [],
      };

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
        resumeId,
        suggestions: [
          {
            id: 'sug-1',
            status: 'PENDING',
            section: 'experience',
            itemIndex: 0,
            original: 'Worked on features',
            optimized: 'Developed new features',
            type: 'content',
          },
          {
            id: 'sug-2',
            status: 'PENDING',
            section: 'skills',
            original: 'Current skills',
            optimized: 'TypeScript',
            type: 'keyword',
          },
        ],
      });

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
        version: 1,
        parsedData: resumeData,
      });

      mockPrismaService.resume.update.mockResolvedValue({
        id: resumeId,
        userId,
        version: 2,
        parsedData: {
          ...resumeData,
          experience: [
            {
              ...resumeData.experience[0],
              description: ['Developed new features', 'Managed team'],
            },
          ],
          skills: ['JavaScript', 'TypeScript'],
        },
      });

      mockPrismaService.optimization.update.mockResolvedValue({
        id: optimizationId,
        userId,
        suggestions: [
          { id: 'sug-1', status: 'ACCEPTED' },
          { id: 'sug-2', status: 'ACCEPTED' },
        ],
      });

      await service.applyBatchSuggestions(
        optimizationId,
        userId,
        suggestionIds
      );

      expect(mockPrismaService.resume.update).toHaveBeenCalledWith({
        where: { id: resumeId },
        data: expect.objectContaining({
          version: 2,
        }),
      });
      expect(mockPrismaService.optimization.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when any suggestion does not exist', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';
      const resumeId = 'resume-123';

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
        resumeId,
        suggestions: [
          {
            id: 'sug-1',
            status: 'PENDING',
          },
        ],
      });

      mockPrismaService.resume.findUnique.mockResolvedValue({
        id: resumeId,
        userId,
        version: 1,
        parsedData: {},
      });

      await expect(
        service.applyBatchSuggestions(optimizationId, userId, [
          'sug-1',
          'non-existent',
        ])
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectSuggestion', () => {
    it('should update suggestion status to REJECTED', async () => {
      const userId = 'user-123';
      const optimizationId = 'opt-123';
      const suggestionId = 'sug-123';

      mockPrismaService.optimization.findUnique.mockResolvedValue({
        id: optimizationId,
        userId,
        suggestions: [
          {
            id: suggestionId,
            status: 'PENDING',
          },
        ],
      });

      mockPrismaService.optimization.update.mockResolvedValue({
        id: optimizationId,
        userId,
        suggestions: [
          {
            id: suggestionId,
            status: 'REJECTED',
          },
        ],
      });

      await service.rejectSuggestion(optimizationId, userId, suggestionId);

      expect(mockPrismaService.optimization.update).toHaveBeenCalled();
    });
  });

  describe('generateSuggestions', () => {
    // **Feature: resume-optimizer-mvp, Property 10: 优化建议数量**
    it('should generate at least 10 suggestions when match score is low', async () => {
      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [
          {
            institution: 'MIT',
            degree: 'Bachelor',
            field: 'Computer Science',
            startDate: '2015',
          },
        ],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Worked on features'],
            achievements: ['Completed projects'],
          },
        ],
        skills: ['JavaScript'],
        projects: [],
      };

      const jobData: ParsedJobData = {
        requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
        preferredSkills: ['Python', 'Docker'],
        responsibilities: ['Build features', 'Review code'],
        keywords: ['microservices', 'cloud', 'agile'],
      };

      const suggestions = await service.generateSuggestions(
        resumeData,
        jobData
      );

      expect(suggestions.length).toBeGreaterThanOrEqual(10);
    });

    // **Feature: resume-optimizer-mvp, Property 11: 优化建议格式**
    it('should include original, optimized, and reason for each suggestion', async () => {
      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Worked on features'],
          },
        ],
        skills: ['JavaScript'],
        projects: [],
      };

      const jobData: ParsedJobData = {
        requiredSkills: ['JavaScript'],
        preferredSkills: [],
        responsibilities: [],
        keywords: [],
      };

      const suggestions = await service.generateSuggestions(
        resumeData,
        jobData
      );

      suggestions.forEach((suggestion) => {
        expect(suggestion).toHaveProperty('original');
        expect(suggestion).toHaveProperty('optimized');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion.original).toBeTruthy();
        expect(suggestion.optimized).toBeTruthy();
        expect(suggestion.reason).toBeTruthy();
      });
    });

    // **Feature: resume-optimizer-mvp, Property 12: STAR 法则应用**
    it('should generate STAR method suggestions for experience descriptions', async () => {
      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Worked on backend systems without metrics'],
          },
        ],
        skills: [],
        projects: [],
      };

      const jobData: ParsedJobData = {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        keywords: [],
      };

      const suggestions = await service.generateSuggestions(
        resumeData,
        jobData
      );

      // Check that we have content suggestions for experience
      const contentSuggestions = suggestions.filter(
        (s) => s.type === 'content'
      );
      expect(contentSuggestions.length).toBeGreaterThan(0);

      // At least one should mention STAR or action verbs
      const hasSuggestionWithSTAROrAction = contentSuggestions.some(
        (s) =>
          s.reason.toLowerCase().includes('star') ||
          s.reason.toLowerCase().includes('action verb') ||
          s.reason.toLowerCase().includes('metrics')
      );
      expect(hasSuggestionWithSTAROrAction).toBe(true);
    });

    // **Feature: resume-optimizer-mvp, Property 13: 关键词插入建议**
    it('should generate keyword insertion suggestions for missing skills', async () => {
      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [],
        skills: ['JavaScript'],
        projects: [],
      };

      const jobData: ParsedJobData = {
        requiredSkills: ['JavaScript', 'TypeScript', 'React'],
        preferredSkills: [],
        responsibilities: [],
        keywords: ['microservices', 'cloud'],
      };

      const suggestions = await service.generateSuggestions(
        resumeData,
        jobData
      );

      // Check that we have keyword suggestions
      const keywordSuggestions = suggestions.filter(
        (s) => s.type === 'keyword'
      );
      expect(keywordSuggestions.length).toBeGreaterThan(0);

      // Verify that keyword suggestions have the required structure
      keywordSuggestions.forEach((suggestion) => {
        expect(suggestion.original).toBeTruthy();
        expect(suggestion.optimized).toBeTruthy();
        expect(suggestion.reason).toBeTruthy();
      });
    });

    // **Feature: resume-optimizer-mvp, Property 14: 建议接受后内容更新**
    it('should have PENDING status for all generated suggestions', async () => {
      const resumeData: ParsedResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        education: [],
        experience: [
          {
            company: 'Google',
            position: 'Software Engineer',
            startDate: '2019',
            description: ['Worked on features'],
          },
        ],
        skills: [],
        projects: [],
      };

      const jobData: ParsedJobData = {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        keywords: [],
      };

      const suggestions = await service.generateSuggestions(
        resumeData,
        jobData
      );

      suggestions.forEach((suggestion) => {
        expect(suggestion.status).toBe('pending');
      });
    });

    // **Feature: resume-optimizer-mvp, Property 10: 优化建议数量 (Property-based test)**
    it('should always generate at least 10 suggestions for any valid resume and job data', async () => {
      const resumeDataArbitrary = fc.record({
        personalInfo: fc.record({
          name: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
        }),
        education: fc.array(
          fc.record({
            institution: fc.string(),
            degree: fc.string(),
            field: fc.string(),
            startDate: fc.string(),
          }),
          { maxLength: 5 }
        ),
        experience: fc.array(
          fc.record({
            company: fc.string(),
            position: fc.string(),
            startDate: fc.string(),
            description: fc.array(fc.string(), { maxLength: 3 }),
            achievements: fc.array(fc.string(), { maxLength: 3 }),
          }),
          { maxLength: 5 }
        ),
        skills: fc.array(fc.string(), { maxLength: 10 }),
        projects: fc.array(
          fc.record({
            name: fc.string(),
            description: fc.string(),
            technologies: fc.array(fc.string()),
            highlights: fc.array(fc.string()),
          }),
          { maxLength: 3 }
        ),
      });

      const jobDataArbitrary = fc.record({
        requiredSkills: fc.array(fc.string(), { maxLength: 10 }),
        preferredSkills: fc.array(fc.string(), { maxLength: 5 }),
        responsibilities: fc.array(fc.string(), { maxLength: 5 }),
        keywords: fc.array(fc.string(), { maxLength: 10 }),
      });

      // Run property test synchronously with sample data
      const samples = fc.sample(
        fc.tuple(resumeDataArbitrary, jobDataArbitrary),
        10
      );

      for (const [resumeData, jobData] of samples) {
        const suggestions = await service.generateSuggestions(
          resumeData as ParsedResumeData,
          jobData as ParsedJobData
        );

        expect(suggestions.length).toBeGreaterThanOrEqual(10);
      }
    });
  });
});
