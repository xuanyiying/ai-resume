/**
 * Performance Monitor Service - Agent Threshold Tests
 * Tests for Agent-specific threshold alerts
 * Property 39: Threshold Alert Triggering
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceMonitorService } from './performance-monitor.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PerformanceMonitorService - Agent Thresholds', () => {
  let service: PerformanceMonitorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    performanceMetrics: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    usageRecord: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PerformanceMonitorService>(PerformanceMonitorService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setAgentThreshold and getAgentThreshold', () => {
    it('should set and retrieve Agent threshold', () => {
      const threshold = {
        agentType: 'pitch-perfect',
        dailyTokenLimit: 10000,
        monthlyTokenLimit: 100000,
        dailyCostLimit: 5,
        monthlyCostLimit: 50,
      };

      service.setAgentThreshold('pitch-perfect', threshold);
      const retrieved = service.getAgentThreshold('pitch-perfect');

      expect(retrieved).toEqual(threshold);
    });

    it('should return undefined for non-existent Agent threshold', () => {
      const retrieved = service.getAgentThreshold('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('checkAgentThresholds', () => {
    it('should return empty array when no threshold is set', async () => {
      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );
      expect(alerts).toEqual([]);
    });

    it('should trigger alert when daily token limit is exceeded', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        dailyTokenLimit: 1000,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

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
          scenario: 'agent-pitch-perfect',
          inputTokens: 600,
          outputTokens: 500,
          cost: 0.01,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('EXCESSIVE_TOKEN_USAGE');
      expect(alerts[0].threshold).toBe(1000);
      expect(alerts[0].currentValue).toBe(1100); // 600 + 500
      expect(alerts[0].period).toBe('daily');
      expect(alerts[0].severity).toBe('WARNING');
    });

    it('should trigger CRITICAL alert when daily token limit is exceeded by 50%', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        dailyTokenLimit: 1000,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

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
          scenario: 'agent-pitch-perfect',
          inputTokens: 1000,
          outputTokens: 600,
          cost: 0.02,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('CRITICAL');
      expect(alerts[0].currentValue).toBe(1600); // 1000 + 600
    });

    it('should trigger alert when monthly token limit is exceeded', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        monthlyTokenLimit: 5000,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 3000,
          outputTokens: 2500,
          cost: 0.05,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('EXCESSIVE_TOKEN_USAGE');
      expect(alerts[0].threshold).toBe(5000);
      expect(alerts[0].currentValue).toBe(5500); // 3000 + 2500
      expect(alerts[0].period).toBe('monthly');
    });

    it('should trigger alert when daily cost limit is exceeded', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        dailyCostLimit: 0.01,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

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
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.015,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('EXCESSIVE_COST');
      expect(alerts[0].threshold).toBe(0.01);
      expect(alerts[0].currentValue).toBe(0.015);
      expect(alerts[0].period).toBe('daily');
    });

    it('should trigger alert when monthly cost limit is exceeded', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        monthlyCostLimit: 0.05,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          model: 'gpt-4',
          provider: 'openai',
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.06,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('EXCESSIVE_COST');
      expect(alerts[0].threshold).toBe(0.05);
      expect(alerts[0].currentValue).toBe(0.06);
      expect(alerts[0].period).toBe('monthly');
    });

    it('should trigger multiple alerts when multiple thresholds are exceeded', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        dailyTokenLimit: 1000,
        dailyCostLimit: 0.01,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

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
          scenario: 'agent-pitch-perfect',
          inputTokens: 600,
          outputTokens: 500,
          cost: 0.015,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(2);
      expect(alerts.some((a) => a.alertType === 'EXCESSIVE_TOKEN_USAGE')).toBe(
        true
      );
      expect(alerts.some((a) => a.alertType === 'EXCESSIVE_COST')).toBe(true);
    });

    it('should not trigger alert when usage is within limits', async () => {
      const threshold = {
        agentType: 'pitch-perfect',
        dailyTokenLimit: 10000,
        dailyCostLimit: 0.1,
      };

      service.setAgentThreshold('pitch-perfect', threshold);

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
          scenario: 'agent-pitch-perfect',
          inputTokens: 150,
          outputTokens: 75,
          cost: 0.005,
          latency: 2000,
          success: true,
          errorCode: null,
          agentType: 'pitch-perfect',
          workflowStep: 'extract-achievements',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.usageRecord.findMany.mockResolvedValue(mockRecords);

      const alerts = await service.checkAgentThresholds(
        'pitch-perfect',
        'user-1'
      );

      expect(alerts).toHaveLength(0);
    });
  });
});
