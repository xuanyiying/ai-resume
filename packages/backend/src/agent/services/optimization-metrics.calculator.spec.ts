/**
 * Optimization Metrics Calculator Tests
 * Property 38: Token Savings Calculation
 * Validates: Requirements 10.3
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  OptimizationMetricsCalculator,
  OptimizationEvent,
} from './optimization-metrics.calculator';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageTrackerService } from '../../ai-providers/tracking/usage-tracker.service';

describe('OptimizationMetricsCalculator', () => {
  let service: OptimizationMetricsCalculator;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockUsageTrackerService: jest.Mocked<UsageTrackerService>;

  beforeEach(async () => {
    mockPrismaService = {
      usageRecord: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockUsageTrackerService = {} as unknown as jest.Mocked<UsageTrackerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizationMetricsCalculator,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsageTrackerService,
          useValue: mockUsageTrackerService,
        },
      ],
    }).compile();

    service = module.get<OptimizationMetricsCalculator>(
      OptimizationMetricsCalculator
    );
  });

  describe('optimization event recording', () => {
    it('should record optimization events', () => {
      const event: OptimizationEvent = {
        type: 'cache-hit',
        timestamp: new Date(),
        tokensSaved: 100,
        costSaved: 0.01,
      };

      service.recordOptimizationEvent(event);

      const events = service.getOptimizationEvents();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('cache-hit');
    });

    it('should record multiple optimization events', () => {
      const events: OptimizationEvent[] = [
        {
          type: 'cache-hit',
          timestamp: new Date(),
          tokensSaved: 100,
          costSaved: 0.01,
        },
        {
          type: 'compression',
          timestamp: new Date(),
          tokensSaved: 200,
          costSaved: 0.02,
          metadata: { compressionRatio: 2.5 },
        },
        {
          type: 'model-routing',
          timestamp: new Date(),
          tokensSaved: 150,
          costSaved: 0.015,
        },
      ];

      events.forEach((e) => service.recordOptimizationEvent(e));

      const recorded = service.getOptimizationEvents();
      expect(recorded.length).toBe(3);
    });
  });

  describe('metrics calculation', () => {
    it('should calculate metrics for a period', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = now;

      // Record some events
      service.recordOptimizationEvent({
        type: 'cache-hit',
        timestamp: now,
        tokensSaved: 100,
        costSaved: 0.01,
      });

      service.recordOptimizationEvent({
        type: 'compression',
        timestamp: now,
        tokensSaved: 200,
        costSaved: 0.02,
        metadata: { compressionRatio: 2.0 },
      });

      // Mock the database call
      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.totalTokensSaved).toBe(300);
      expect(metrics.totalCostSavings).toBe(0.03);
      expect(metrics.cachingSavings.cacheHits).toBe(1);
      expect(metrics.cachingSavings.tokensSaved).toBe(100);
      expect(metrics.compressionSavings.compressionEvents).toBe(1);
      expect(metrics.compressionSavings.tokensSaved).toBe(200);
    });

    it('should calculate caching savings', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      // Record cache hit events
      for (let i = 0; i < 5; i++) {
        service.recordOptimizationEvent({
          type: 'cache-hit',
          timestamp: now,
          tokensSaved: 50,
          costSaved: 0.005,
        });
      }

      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.cachingSavings.cacheHits).toBe(5);
      expect(metrics.cachingSavings.tokensSaved).toBe(250);
    });

    it('should calculate compression savings with ratio', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      // Record compression events with different ratios
      service.recordOptimizationEvent({
        type: 'compression',
        timestamp: now,
        tokensSaved: 100,
        costSaved: 0.01,
        metadata: { compressionRatio: 2.0 },
      });

      service.recordOptimizationEvent({
        type: 'compression',
        timestamp: now,
        tokensSaved: 150,
        costSaved: 0.015,
        metadata: { compressionRatio: 3.0 },
      });

      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.compressionSavings.compressionEvents).toBe(2);
      expect(metrics.compressionSavings.tokensSaved).toBe(250);
      expect(metrics.compressionSavings.averageCompressionRatio).toBe(2.5);
    });

    it('should calculate model routing savings', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      // Record model routing events
      for (let i = 0; i < 3; i++) {
        service.recordOptimizationEvent({
          type: 'model-routing',
          timestamp: now,
          tokensSaved: 75,
          costSaved: 0.0075,
        });
      }

      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.modelRoutingSavings.routingDecisions).toBe(3);
      expect(metrics.modelRoutingSavings.tokensSaved).toBe(225);
    });

    it('should calculate batch processing savings', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      // Record batch processing events
      service.recordOptimizationEvent({
        type: 'batch-processing',
        timestamp: now,
        tokensSaved: 500,
        costSaved: 0.05,
      });

      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.batchProcessingSavings.batchJobs).toBe(1);
      expect(metrics.batchProcessingSavings.tokensSaved).toBe(500);
    });

    it('should calculate percentage distribution of savings', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      // Record events with different types
      service.recordOptimizationEvent({
        type: 'cache-hit',
        timestamp: now,
        tokensSaved: 100,
        costSaved: 0.01,
      });

      service.recordOptimizationEvent({
        type: 'compression',
        timestamp: now,
        tokensSaved: 200,
        costSaved: 0.02,
        metadata: { compressionRatio: 2.0 },
      });

      service.recordOptimizationEvent({
        type: 'model-routing',
        timestamp: now,
        tokensSaved: 200,
        costSaved: 0.02,
      });

      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const metrics = await service.calculateMetrics(startDate, endDate);

      const total = metrics.totalTokensSaved;
      expect(metrics.cachingSavings.percentageOfTotal).toBeCloseTo(
        (100 / total) * 100,
        1
      );
      expect(metrics.compressionSavings.percentageOfTotal).toBeCloseTo(
        (200 / total) * 100,
        1
      );
      expect(metrics.modelRoutingSavings.percentageOfTotal).toBeCloseTo(
        (200 / total) * 100,
        1
      );
    });
  });

  describe('event management', () => {
    it('should clear optimization events', () => {
      service.recordOptimizationEvent({
        type: 'cache-hit',
        timestamp: new Date(),
        tokensSaved: 100,
        costSaved: 0.01,
      });

      expect(service.getOptimizationEvents().length).toBe(1);

      service.clearOptimizationEvents();

      expect(service.getOptimizationEvents().length).toBe(0);
    });

    it('should get all optimization events', () => {
      const events: OptimizationEvent[] = [
        {
          type: 'cache-hit',
          timestamp: new Date(),
          tokensSaved: 100,
          costSaved: 0.01,
        },
        {
          type: 'compression',
          timestamp: new Date(),
          tokensSaved: 200,
          costSaved: 0.02,
          metadata: { compressionRatio: 2.0 },
        },
      ];

      events.forEach((e) => service.recordOptimizationEvent(e));

      const recorded = service.getOptimizationEvents();

      expect(recorded.length).toBe(2);
      expect(recorded[0].type).toBe('cache-hit');
      expect(recorded[1].type).toBe('compression');
    });
  });

  describe('report generation', () => {
    it('should generate optimization report', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      service.recordOptimizationEvent({
        type: 'cache-hit',
        timestamp: now,
        tokensSaved: 100,
        costSaved: 0.01,
      });

      (mockPrismaService.usageRecord.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const report = await service.generateOptimizationReport(
        startDate,
        endDate
      );

      expect(report).toContain('Optimization Metrics Report');
      expect(report).toContain('Total Tokens Saved');
      expect(report).toContain('Caching Savings');
    });
  });
});
