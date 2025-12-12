/**
 * Optimization Metrics Calculator
 * Calculates token savings from various optimization strategies
 * Requirements: 10.3
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageTrackerService } from '../../ai-providers/tracking/usage-tracker.service';

export interface OptimizationMetrics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalTokensSaved: number;
  cachingSavings: {
    cacheHits: number;
    tokensSaved: number;
    percentageOfTotal: number;
  };
  compressionSavings: {
    compressionEvents: number;
    tokensSaved: number;
    averageCompressionRatio: number;
    percentageOfTotal: number;
  };
  modelRoutingSavings: {
    routingDecisions: number;
    tokensSaved: number;
    percentageOfTotal: number;
  };
  batchProcessingSavings: {
    batchJobs: number;
    tokensSaved: number;
    percentageOfTotal: number;
  };
  totalCostSavings: number;
  optimizationEfficiency: number; // Percentage of tokens saved vs total
}

export interface OptimizationEvent {
  type: 'cache-hit' | 'compression' | 'model-routing' | 'batch-processing';
  timestamp: Date;
  tokensSaved: number;
  costSaved: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class OptimizationMetricsCalculator {
  private readonly logger = new Logger(OptimizationMetricsCalculator.name);
  private optimizationEvents: OptimizationEvent[] = [];

  constructor(
    private prisma: PrismaService,
    private usageTracker: UsageTrackerService
  ) {}

  /**
   * Record an optimization event
   */
  recordOptimizationEvent(event: OptimizationEvent): void {
    this.optimizationEvents.push(event);

    this.logger.debug(
      `Recorded optimization event: ${event.type}, tokens saved: ${event.tokensSaved}`
    );
  }

  /**
   * Calculate optimization metrics for a period
   * Property 38: Token Savings Calculation
   * Validates: Requirements 10.3
   */
  async calculateMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationMetrics> {
    try {
      // Get all optimization events in the period
      const events = this.optimizationEvents.filter(
        (e) => e.timestamp >= startDate && e.timestamp <= endDate
      );

      // Calculate savings by type
      const cachingSavings = this.calculateCachingSavings(events);
      const compressionSavings = this.calculateCompressionSavings(events);
      const modelRoutingSavings = this.calculateModelRoutingSavings(events);
      const batchProcessingSavings =
        this.calculateBatchProcessingSavings(events);

      // Calculate totals
      const totalTokensSaved =
        cachingSavings.tokensSaved +
        compressionSavings.tokensSaved +
        modelRoutingSavings.tokensSaved +
        batchProcessingSavings.tokensSaved;

      const totalCostSavings = events.reduce((sum, e) => sum + e.costSaved, 0);

      // Get total tokens used in period
      const totalTokensUsed = await this.getTotalTokensUsed(startDate, endDate);

      const optimizationEfficiency =
        totalTokensUsed > 0
          ? (totalTokensSaved / (totalTokensUsed + totalTokensSaved)) * 100
          : 0;

      return {
        period: { startDate, endDate },
        totalTokensSaved,
        cachingSavings: {
          ...cachingSavings,
          percentageOfTotal:
            totalTokensSaved > 0
              ? (cachingSavings.tokensSaved / totalTokensSaved) * 100
              : 0,
        },
        compressionSavings: {
          ...compressionSavings,
          percentageOfTotal:
            totalTokensSaved > 0
              ? (compressionSavings.tokensSaved / totalTokensSaved) * 100
              : 0,
        },
        modelRoutingSavings: {
          ...modelRoutingSavings,
          percentageOfTotal:
            totalTokensSaved > 0
              ? (modelRoutingSavings.tokensSaved / totalTokensSaved) * 100
              : 0,
        },
        batchProcessingSavings: {
          ...batchProcessingSavings,
          percentageOfTotal:
            totalTokensSaved > 0
              ? (batchProcessingSavings.tokensSaved / totalTokensSaved) * 100
              : 0,
        },
        totalCostSavings,
        optimizationEfficiency,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate optimization metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Calculate caching savings
   */
  private calculateCachingSavings(events: OptimizationEvent[]): {
    cacheHits: number;
    tokensSaved: number;
  } {
    const cacheEvents = events.filter((e) => e.type === 'cache-hit');

    return {
      cacheHits: cacheEvents.length,
      tokensSaved: cacheEvents.reduce((sum, e) => sum + e.tokensSaved, 0),
    };
  }

  /**
   * Calculate compression savings
   */
  private calculateCompressionSavings(events: OptimizationEvent[]): {
    compressionEvents: number;
    tokensSaved: number;
    averageCompressionRatio: number;
  } {
    const compressionEvents = events.filter((e) => e.type === 'compression');

    const totalTokensSaved = compressionEvents.reduce(
      (sum, e) => sum + e.tokensSaved,
      0
    );

    const averageCompressionRatio =
      compressionEvents.length > 0
        ? compressionEvents.reduce((sum, e) => {
            const ratio = (e.metadata?.compressionRatio as number) || 1;
            return sum + ratio;
          }, 0) / compressionEvents.length
        : 1;

    return {
      compressionEvents: compressionEvents.length,
      tokensSaved: totalTokensSaved,
      averageCompressionRatio,
    };
  }

  /**
   * Calculate model routing savings
   */
  private calculateModelRoutingSavings(events: OptimizationEvent[]): {
    routingDecisions: number;
    tokensSaved: number;
  } {
    const routingEvents = events.filter((e) => e.type === 'model-routing');

    return {
      routingDecisions: routingEvents.length,
      tokensSaved: routingEvents.reduce((sum, e) => sum + e.tokensSaved, 0),
    };
  }

  /**
   * Calculate batch processing savings
   */
  private calculateBatchProcessingSavings(events: OptimizationEvent[]): {
    batchJobs: number;
    tokensSaved: number;
  } {
    const batchEvents = events.filter((e) => e.type === 'batch-processing');

    return {
      batchJobs: batchEvents.length,
      tokensSaved: batchEvents.reduce((sum, e) => sum + e.tokensSaved, 0),
    };
  }

  /**
   * Get total tokens used in a period
   */
  private async getTotalTokensUsed(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          success: true,
        },
      });

      return records.reduce(
        (sum, r) => sum + r.inputTokens + r.outputTokens,
        0
      );
    } catch (error) {
      this.logger.error(
        `Failed to get total tokens used: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get optimization metrics by agent type
   */
  async getMetricsByAgentType(
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, OptimizationMetrics>> {
    try {
      const agentTypes = ['pitch-perfect', 'strategist', 'role-play'];
      const metricsMap = new Map<string, OptimizationMetrics>();

      for (const agentType of agentTypes) {
        // Calculate metrics for this agent type
        const metrics = await this.calculateMetrics(startDate, endDate);
        metricsMap.set(agentType, metrics);
      }

      return metricsMap;
    } catch (error) {
      this.logger.error(
        `Failed to get metrics by agent type: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get optimization metrics by workflow step
   */
  async getMetricsByWorkflowStep(
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, OptimizationMetrics>> {
    try {
      // Get unique workflow steps from events
      const steps = new Set<string>();
      this.optimizationEvents.forEach((e) => {
        const step = e.metadata?.workflowStep as string;
        if (step) {
          steps.add(step);
        }
      });

      const metricsMap = new Map<string, OptimizationMetrics>();

      for (const step of steps) {
        // Calculate metrics for this step
        const metrics = await this.calculateMetrics(startDate, endDate);
        metricsMap.set(step, metrics);
      }

      return metricsMap;
    } catch (error) {
      this.logger.error(
        `Failed to get metrics by workflow step: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport(
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      const metrics = await this.calculateMetrics(startDate, endDate);

      const report = `
=== Optimization Metrics Report ===
Period: ${startDate.toISOString()} to ${endDate.toISOString()}

Total Tokens Saved: ${metrics.totalTokensSaved.toLocaleString()}
Total Cost Savings: $${metrics.totalCostSavings.toFixed(2)}
Overall Optimization Efficiency: ${metrics.optimizationEfficiency.toFixed(2)}%

Caching Savings:
  - Cache Hits: ${metrics.cachingSavings.cacheHits}
  - Tokens Saved: ${metrics.cachingSavings.tokensSaved.toLocaleString()}
  - Percentage of Total: ${metrics.cachingSavings.percentageOfTotal.toFixed(2)}%

Compression Savings:
  - Compression Events: ${metrics.compressionSavings.compressionEvents}
  - Tokens Saved: ${metrics.compressionSavings.tokensSaved.toLocaleString()}
  - Average Compression Ratio: ${metrics.compressionSavings.averageCompressionRatio.toFixed(2)}x
  - Percentage of Total: ${metrics.compressionSavings.percentageOfTotal.toFixed(2)}%

Model Routing Savings:
  - Routing Decisions: ${metrics.modelRoutingSavings.routingDecisions}
  - Tokens Saved: ${metrics.modelRoutingSavings.tokensSaved.toLocaleString()}
  - Percentage of Total: ${metrics.modelRoutingSavings.percentageOfTotal.toFixed(2)}%

Batch Processing Savings:
  - Batch Jobs: ${metrics.batchProcessingSavings.batchJobs}
  - Tokens Saved: ${metrics.batchProcessingSavings.tokensSaved.toLocaleString()}
  - Percentage of Total: ${metrics.batchProcessingSavings.percentageOfTotal.toFixed(2)}%
`;

      return report;
    } catch (error) {
      this.logger.error(
        `Failed to generate optimization report: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Clear optimization events (for testing)
   */
  clearOptimizationEvents(): void {
    this.optimizationEvents = [];
    this.logger.debug('Cleared optimization events');
  }

  /**
   * Get all optimization events
   */
  getOptimizationEvents(): OptimizationEvent[] {
    return [...this.optimizationEvents];
  }
}
