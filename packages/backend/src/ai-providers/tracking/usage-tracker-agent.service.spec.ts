/**
 * Usage Tracker Service - Agent Tracking Tests
 * Tests for Agent-specific usage tracking and multi-dimensional aggregation
 * Property 36: Token Usage Tracking Completeness
 * Property 37: Multi-Dimensional Usage Aggregation
 * Property 40: Step-Level Token Breakdown
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackerService } from './usage-tracker.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsageTrackerService - Agent Tracking', () => {
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

  describe('recordUsage with Agent tracking', () => {
    it('should record Agent usage with agentType and workflowStep', async () => {
      const agentUsageData = {
        userId: 'user-1',
        model: 'gpt-4',
        provider: 'openai',
        scenario: 'agent-pitch-perfect',
        inputTokens: 150,
        outputTokens: 75,
        cost: 0.005,
        latency: 2000,
        success: true,
        agentType: 'pitch-perfect',
        workflowStep: 'extract-achievements',
      };

      const mockRecord = {
        id: 'record-1',
        ...agentUsageData,
        errorCode: null,
        timestamp: new Date(),
      };

      mockPrismaService.usageRecord.create.mockResolvedValue(mockRecord);

      const result = await service.recordUsage(agentUsageData);

      expect(result.id).toBe('record-1');
      expect(result.agentType).toBe('pitch-perfect');
      expect(result.workflowStep).toBe('extract-achievements');
      expect(result.inputTokens).toBe(150);
      expect(result.outputTokens).toBe(75);
      expect(mockPrismaService.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
        }),
      });
    });

    it('should record usage without Agent fields for backward compatibility', async () => {
      const usageData = {
        userId: 'user-1',
        model: 'gpt-4',
        provider: 'openai',
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
        agentType: null,
        workflowStep: null,
        timestamp: new Date(),
      };

      mockPrismaService.usageRecord.create.mockResolvedValue(mockRecord);

      const result = await service.recordUsage(usageData as any);

      expect(result.agentType).toBeUndefined();
      expect(result.workflowStep).toBeUndefined();
    });
  });

  describe('getCostByAgentType', () => {
    it('should aggregate cost by Agent type', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'generate-introduction',
          timestamp: new Date('2024-01-16'),
        },
        {
          id: '3',
          userId: 'user-1',
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          scenario: 'agent-strategist',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.002,
          latency: 1500,
          success: true,
          errorCode: null,
          agentType: 'strategist',
          workflowStep: 'analyze-context',
          timestamp: new Date('2024-01-17'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByAgentType(startDate, endDate);

      expect(result.get('pitch-perfect')).toBe(0.01);
      expect(result.get('strategist')).toBe(0.002);
    });

    it('should filter by specific Agent type', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByAgentType(
        startDate,
        endDate,
        'pitch-perfect'
      );

      expect(mockPrismaService.usageRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          agentType: 'pitch-perfect',
        }),
      });

      expect(result.get('pitch-perfect')).toBe(0.005);
    });
  });

  describe('getCostByWorkflowStep', () => {
    it('should aggregate cost by workflow step', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'generate-introduction',
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByWorkflowStep(startDate, endDate);

      expect(result.get('extract-achievements')).toBe(0.005);
      expect(result.get('generate-introduction')).toBe(0.005);
    });

    it('should filter by Agent type when provided', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const result = await service.getCostByWorkflowStep(
        startDate,
        endDate,
        'pitch-perfect'
      );

      expect(mockPrismaService.usageRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          agentType: 'pitch-perfect',
        }),
      });

      expect(result.get('extract-achievements')).toBe(0.005);
    });
  });

  describe('generateStepBreakdown', () => {
    it('should generate step-level token breakdown', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-16'),
        },
        {
          id: '3',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 200,
          outputTokens: 100,
          cost: 0.008,
          latency: 3000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'generate-introduction',
          timestamp: new Date('2024-01-17'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const breakdown = await service.generateStepBreakdown(
        'session-1',
        startDate,
        endDate
      );

      expect(breakdown.totalTokens).toBe(900); // (150+75)*2 + (200+100)
      expect(breakdown.totalCost).toBe(0.018);
      expect(breakdown.steps).toHaveLength(2);

      const extractStep = breakdown.steps.find(
        (s) => s.stepName === 'extract-achievements'
      );
      expect(extractStep?.inputTokens).toBe(300);
      expect(extractStep?.outputTokens).toBe(150);
      expect(extractStep?.totalTokens).toBe(450);
      expect(extractStep?.cost).toBe(0.01);
      expect(extractStep?.callCount).toBe(2);

      const generateStep = breakdown.steps.find(
        (s) => s.stepName === 'generate-introduction'
      );
      expect(generateStep?.inputTokens).toBe(200);
      expect(generateStep?.outputTokens).toBe(100);
      expect(generateStep?.totalTokens).toBe(300);
      expect(generateStep?.cost).toBe(0.008);
      expect(generateStep?.callCount).toBe(1);
    });

    it('should calculate average latency per step', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 3000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const breakdown = await service.generateStepBreakdown(
        'session-1',
        startDate,
        endDate
      );

      const extractStep = breakdown.steps.find(
        (s) => s.stepName === 'extract-achievements'
      );
      expect(extractStep?.averageLatency).toBe(2500); // (2000 + 3000) / 2
    });
  });

  describe('generateCostReport with Agent grouping', () => {
    it('should generate cost report grouped by agent-type', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          scenario: 'agent-strategist',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.002,
          latency: 1500,
          success: true,
          errorCode: null,
          agentType: 'strategist',
          workflowStep: 'analyze-context',
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const report = await service.generateCostReport(
        startDate,
        endDate,
        'agent-type'
      );

      expect(report.groupBy).toBe('agent-type');
      expect(report.totalCost).toBe(0.007);
      expect(report.items).toHaveLength(2);

      const pitchPerfectItem = report.items.find(
        (i) => i.key === 'pitch-perfect'
      );
      expect(pitchPerfectItem?.cost).toBe(0.005);
      expect(pitchPerfectItem?.callCount).toBe(1);

      const strategistItem = report.items.find((i) => i.key === 'strategist');
      expect(strategistItem?.cost).toBe(0.002);
      expect(strategistItem?.callCount).toBe(1);
    });

    it('should generate cost report grouped by workflow-step', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date('2024-01-15'),
        },
        {
          id: '2',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 200,
          outputTokens: 100,
          cost: 0.008,
          latency: 3000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'generate-introduction',
          timestamp: new Date('2024-01-16'),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const report = await service.generateCostReport(
        startDate,
        endDate,
        'workflow-step'
      );

      expect(report.groupBy).toBe('workflow-step');
      expect(report.totalCost).toBe(0.013);
      expect(report.items).toHaveLength(2);

      const extractItem = report.items.find(
        (i) => i.key === 'extract-achievements'
      );
      expect(extractItem?.cost).toBe(0.005);

      const generateItem = report.items.find(
        (i) => i.key === 'generate-introduction'
      );
      expect(generateItem?.cost).toBe(0.008);
    });
  });
});
