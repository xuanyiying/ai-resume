/**
 * Usage Tracker Service Tests
 * Tests for cost tracking and reporting functionality
 * Property 35: 使用量记录完整性
 * Property 36: 成本聚合
 * Property 37: 成本报告生成
 * Property 40: 成本报告导出
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackerService } from './usage-tracker.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsageTrackerService', () => {
  let service: UsageTrackerService;

  const mockPrismaService = {
    usageRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsageTrackerService>(UsageTrackerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordUsage', () => {
    it('should record usage successfully', async () => {
      const usageData = {
        userId: 'user-1',
        model: 'gpt-4',
        provider: 'openai',
        scenario: 'resume-parsing',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.003,
        latency: 1500,
        success: true,
      };

      const mockRecord = {
        id: 'record-1',
        ...usageData,
        errorCode: null,
        timestamp: new Date(),
      };

      mockPrismaService.usageRecord.create.mockResolvedValue(mockRecord);

      const result = await service.recordUsage(usageData);

      expect(result.id).toBe('record-1');
      expect(result.userId).toBe(usageData.userId);
      expect(result.model).toBe(usageData.model);
      expect(result.provider).toBe(usageData.provider);
      expect(result.inputTokens).toBe(usageData.inputTokens);
      expect(result.outputTokens).toBe(usageData.outputTokens);
      expect(result.cost).toBe(usageData.cost);
      expect(result.latency).toBe(usageData.latency);
      expect(result.success).toBe(usageData.success);
      expect(mockPrismaService.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: usageData.userId,
          model: usageData.model,
          provider: usageData.provider,
          inputTokens: usageData.inputTokens,
          outputTokens: usageData.outputTokens,
          cost: usageData.cost,
          latency: usageData.latency,
          success: usageData.success,
        }),
      });
    });

    it('should throw error for invalid usage record', async () => {
      const invalidData = {
        userId: '',
        model: 'gpt-4',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.003,
        latency: 1500,
        success: true,
      };

      await expect(service.recordUsage(invalidData as any)).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should throw error for negative cost', async () => {
      const invalidData = {
        userId: 'user-1',
        model: 'gpt-4',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cost: -0.003,
        latency: 1500,
        success: true,
      };

      await expect(service.recordUsage(invalidData as any)).rejects.toThrow(
        'Cost must be non-negative'
      );
    });
  });

  describe('getCostByModel', () => {
    it('should aggregate cost by model', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-16'),
        },
        {
          id: '3',
          userId: 'user-1',
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.001,
          latency: 1000,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-17'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByModel(startDate, endDate);

      expect(result.get('gpt-4')).toBe(0.006);
      expect(result.get('gpt-3.5-turbo')).toBe(0.001);
    });

    it('should filter by specific model', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByModel(startDate, endDate, 'gpt-4');

      expect(mockPrismaService.usageRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          model: 'gpt-4',
        }),
      });

      expect(result.get('gpt-4')).toBe(0.003);
    });
  });

  describe('getCostByScenario', () => {
    it('should aggregate cost by scenario', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-optimization',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByScenario(startDate, endDate);

      expect(result.get('resume-parsing')).toBe(0.003);
      expect(result.get('resume-optimization')).toBe(0.005);
    });
  });

  describe('getCostByUser', () => {
    it('should aggregate cost by user', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-2',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByUser(startDate, endDate);

      expect(result.get('user-1')).toBe(0.003);
      expect(result.get('user-2')).toBe(0.003);
    });
  });

  describe('generateCostReport', () => {
    it('should generate cost report grouped by model', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const report = await service.generateCostReport(
        startDate,
        endDate,
        'model'
      );

      expect(report.groupBy).toBe('model');
      expect(report.totalCost).toBe(0.006);
      expect(report.items).toHaveLength(1);
      expect(report.items[0].key).toBe('gpt-4');
      expect(report.items[0].cost).toBe(0.006);
      expect(report.items[0].callCount).toBe(2);
      expect(report.items[0].inputTokens).toBe(200);
      expect(report.items[0].outputTokens).toBe(100);
    });

    it('should generate cost report grouped by scenario', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const report = await service.generateCostReport(
        startDate,
        endDate,
        'scenario'
      );

      expect(report.groupBy).toBe('scenario');
      expect(report.items[0].key).toBe('resume-parsing');
    });

    it('should generate cost report grouped by user', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const report = await service.generateCostReport(
        startDate,
        endDate,
        'user'
      );

      expect(report.groupBy).toBe('user');
      expect(report.items[0].key).toBe('user-1');
    });
  });

  describe('exportCostReportToCSV', () => {
    it('should export cost report to CSV format', async () => {
      const report = {
        period: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        groupBy: 'model' as const,
        totalCost: 0.006,
        items: [
          {
            key: 'gpt-4',
            cost: 0.006,
            callCount: 2,
            inputTokens: 200,
            outputTokens: 100,
            averageLatency: 1500,
          },
        ],
      };

      const csv = await service.exportCostReportToCSV(report);

      expect(csv).toContain('Key,Cost,Call Count,Input Tokens,Output Tokens');
      expect(csv).toContain('gpt-4,0.006,2,200,100,1500');
      expect(csv).toContain('Report Period:');
      expect(csv).toContain('Grouped By: model');
      expect(csv).toContain('Total Cost: 0.006');
    });
  });

  describe('exportCostReportToJSON', () => {
    it('should export cost report to JSON format', async () => {
      const report = {
        period: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        groupBy: 'model' as const,
        totalCost: 0.006,
        items: [
          {
            key: 'gpt-4',
            cost: 0.006,
            callCount: 2,
            inputTokens: 200,
            outputTokens: 100,
            averageLatency: 1500,
          },
        ],
      };

      const json = await service.exportCostReportToJSON(report);
      const parsed = JSON.parse(json);

      expect(parsed.groupBy).toBe('model');
      expect(parsed.totalCost).toBe(0.006);
      expect(parsed.items).toHaveLength(1);
    });
  });

  describe('setCostThreshold and checkCostThreshold', () => {
    it('should set and retrieve cost threshold', () => {
      const threshold = {
        dailyLimit: 10,
        monthlyLimit: 100,
        alertEmail: 'user@example.com',
      };

      service.setCostThreshold('user-1', threshold);
      const retrieved = service.getCostThreshold('user-1');

      expect(retrieved).toEqual(threshold);
    });

    it('should check if daily cost exceeds threshold', async () => {
      const threshold = {
        dailyLimit: 0.002,
      };

      service.setCostThreshold('user-1', threshold);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const exceeded = await service.checkCostThreshold('user-1');

      expect(exceeded).toBe(true);
    });
  });

  describe('getModelUsageStats', () => {
    it('should return model usage statistics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: false,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const stats = await service.getModelUsageStats(
        'gpt-4',
        startDate,
        endDate
      );

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(1);
      expect(stats.failedCalls).toBe(1);
      expect(stats.totalCost).toBe(0.006);
      expect(stats.totalInputTokens).toBe(200);
      expect(stats.totalOutputTokens).toBe(100);
      expect(stats.averageLatency).toBe(1500);
    });
  });

  describe('getUserUsageStats', () => {
    it('should return user usage statistics with model breakdown', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.003,
          latency: 1500,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          scenario: 'resume-parsing',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.001,
          latency: 1000,
          success: true,
          errorCode: null,
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const stats = await service.getUserUsageStats(
        'user-1',
        startDate,
        endDate
      );

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.failedCalls).toBe(0);
      expect(stats.totalCost).toBe(0.004);
      expect(stats.modelBreakdown.get('gpt-4')).toBe(0.003);
      expect(stats.modelBreakdown.get('gpt-3.5-turbo')).toBe(0.001);
    });
  });

  describe('cleanupOldRecords', () => {
    it('should delete records older than specified days', async () => {
      mockPrismaService.usageRecord.deleteMany.mockResolvedValue({
        count: 100,
      });

      const deleted = await service.cleanupOldRecords(90);

      expect(deleted).toBe(100);
      expect(mockPrismaService.usageRecord.deleteMany).toHaveBeenCalled();
    });
  });
});
