/**
 * Usage Tracker Service
 * Tracks AI model usage, costs, and generates reports
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageRecord as PrismaUsageRecord } from '@prisma/client';

export interface UsageRecord {
  id: string;
  userId: string;
  model: string;
  provider: string;
  scenario?: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  success: boolean;
  errorCode?: string;
  timestamp: Date;
  agentType?: string; // 'pitch-perfect' | 'strategist' | 'role-play'
  workflowStep?: string; // Step name in Agent workflow
}

export interface CostReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  groupBy: 'model' | 'scenario' | 'user' | 'agent-type' | 'workflow-step';
  totalCost: number;
  items: Array<{
    key: string;
    cost: number;
    callCount: number;
    inputTokens: number;
    outputTokens: number;
    averageLatency: number;
  }>;
}

export interface CostThreshold {
  dailyLimit?: number;
  monthlyLimit?: number;
  alertEmail?: string;
}

@Injectable()
export class UsageTrackerService {
  private readonly logger = new Logger(UsageTrackerService.name);
  private costThresholds: Map<string, CostThreshold> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Record AI usage
   * Property 35: 使用量记录完整性
   * Property 36: Token Usage Tracking Completeness
   */
  async recordUsage(
    record: Omit<UsageRecord, 'id' | 'timestamp'>
  ): Promise<UsageRecord> {
    try {
      // Validate input
      this.validateUsageRecord(record);

      const created = await this.prisma.usageRecord.create({
        data: {
          userId: record.userId,
          model: record.model,
          provider: record.provider,
          scenario: record.scenario || null,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          cost: record.cost,
          latency: record.latency,
          success: record.success,
          errorCode: record.errorCode || null,
          agentType: record.agentType || null,
          workflowStep: record.workflowStep || null,
          timestamp: new Date(),
        },
      });

      const logMessage = record.agentType
        ? `Recorded Agent usage (${record.agentType}/${record.workflowStep}): ${record.inputTokens} input tokens, ${record.outputTokens} output tokens, cost: ${record.cost}`
        : `Recorded usage for model ${record.model}: ${record.inputTokens} input tokens, ${record.outputTokens} output tokens, cost: ${record.cost}`;

      this.logger.debug(logMessage);

      return this.mapPrismaToUsageRecord(created);
    } catch (error) {
      this.logger.error(
        `Failed to record usage: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cost by model
   * Property 36: 成本聚合
   */
  async getCostByModel(
    startDate: Date,
    endDate: Date,
    model?: string
  ): Promise<Map<string, number>> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(model && { model }),
          success: true,
        },
      });

      const costMap = new Map<string, number>();

      for (const record of records) {
        const current = costMap.get(record.model) || 0;
        costMap.set(record.model, current + record.cost);
      }

      return costMap;
    } catch (error) {
      this.logger.error(
        `Failed to get cost by model: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cost by scenario
   * Property 36: 成本聚合
   */
  async getCostByScenario(
    startDate: Date,
    endDate: Date,
    scenario?: string
  ): Promise<Map<string, number>> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(scenario && { scenario }),
          success: true,
        },
      });

      const costMap = new Map<string, number>();

      for (const record of records) {
        const key = record.scenario || 'unknown';
        const current = costMap.get(key) || 0;
        costMap.set(key, current + record.cost);
      }

      return costMap;
    } catch (error) {
      this.logger.error(
        `Failed to get cost by scenario: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cost by user
   * Property 36: 成本聚合
   */
  async getCostByUser(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<Map<string, number>> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(userId && { userId }),
          success: true,
        },
      });

      const costMap = new Map<string, number>();

      for (const record of records) {
        const current = costMap.get(record.userId) || 0;
        costMap.set(record.userId, current + record.cost);
      }

      return costMap;
    } catch (error) {
      this.logger.error(
        `Failed to get cost by user: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cost by Agent type
   * Property 37: Multi-Dimensional Usage Aggregation
   */
  async getCostByAgentType(
    startDate: Date,
    endDate: Date,
    agentType?: string
  ): Promise<Map<string, number>> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(agentType && { agentType }),
          success: true,
          ...(agentType === undefined && { agentType: { not: null } }),
        },
      });

      const costMap = new Map<string, number>();

      for (const record of records as any[]) {
        const key = record.agentType || 'unknown';
        const current = costMap.get(key) || 0;
        costMap.set(key, current + record.cost);
      }

      return costMap;
    } catch (error) {
      this.logger.error(
        `Failed to get cost by Agent type: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cost by workflow step
   * Property 37: Multi-Dimensional Usage Aggregation
   */
  async getCostByWorkflowStep(
    startDate: Date,
    endDate: Date,
    agentType?: string
  ): Promise<Map<string, number>> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(agentType && { agentType }),
          success: true,
          ...(agentType === undefined && { workflowStep: { not: null } }),
        },
      });

      const costMap = new Map<string, number>();

      for (const record of records as any[]) {
        const key = record.workflowStep || 'unknown';
        const current = costMap.get(key) || 0;
        costMap.set(key, current + record.cost);
      }

      return costMap;
    } catch (error) {
      this.logger.error(
        `Failed to get cost by workflow step: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate step-level token breakdown for Agent workflow
   * Property 40: Step-Level Token Breakdown
   */
  async generateStepBreakdown(
    agentSessionId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTokens: number;
    totalCost: number;
    steps: Array<{
      stepName: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
      callCount: number;
      averageLatency: number;
      optimizationSavings?: number;
    }>;
  }> {
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

      const stepMap = new Map<
        string,
        {
          inputTokens: number;
          outputTokens: number;
          cost: number;
          callCount: number;
          latencies: number[];
        }
      >();

      for (const record of records as any[]) {
        const stepName = record.workflowStep || 'unknown';
        if (stepName === 'unknown') continue; // Skip records without workflow step

        const current = stepMap.get(stepName) || {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          callCount: 0,
          latencies: [],
        };

        current.inputTokens += record.inputTokens;
        current.outputTokens += record.outputTokens;
        current.cost += record.cost;
        current.callCount += 1;
        current.latencies.push(record.latency);

        stepMap.set(stepName, current);
      }

      const steps = Array.from(stepMap.entries()).map(([stepName, data]) => ({
        stepName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        cost: Math.round(data.cost * 10000) / 10000,
        callCount: data.callCount,
        averageLatency:
          data.latencies.length > 0
            ? Math.round(
                (data.latencies.reduce((a, b) => a + b, 0) /
                  data.latencies.length) *
                  100
              ) / 100
            : 0,
      }));

      const totalTokens = steps.reduce((sum, s) => sum + s.totalTokens, 0);
      const totalCost = steps.reduce((sum, s) => sum + s.cost, 0);

      return {
        totalTokens,
        totalCost: Math.round(totalCost * 10000) / 10000,
        steps: steps.sort((a, b) => b.cost - a.cost),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate step breakdown: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate cost report
   * Property 37: 成本报告生成
   */
  async generateCostReport(
    startDate: Date,
    endDate: Date,
    groupBy: 'model' | 'scenario' | 'user' | 'agent-type' | 'workflow-step'
  ): Promise<CostReport> {
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

      const groupMap = new Map<
        string,
        {
          cost: number;
          callCount: number;
          inputTokens: number;
          outputTokens: number;
          latencies: number[];
        }
      >();

      for (const record of records) {
        let key: string;

        if (groupBy === 'model') {
          key = record.model;
        } else if (groupBy === 'scenario') {
          key = record.scenario || 'unknown';
        } else if (groupBy === 'agent-type') {
          key = record.agentType || 'unknown';
        } else if (groupBy === 'workflow-step') {
          key = record.workflowStep || 'unknown';
        } else {
          key = record.userId;
        }

        const current = groupMap.get(key) || {
          cost: 0,
          callCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          latencies: [],
        };

        current.cost += record.cost;
        current.callCount += 1;
        current.inputTokens += record.inputTokens;
        current.outputTokens += record.outputTokens;
        current.latencies.push(record.latency);

        groupMap.set(key, current);
      }

      const items = Array.from(groupMap.entries()).map(([key, data]) => ({
        key,
        cost: Math.round(data.cost * 10000) / 10000, // Round to 4 decimal places
        callCount: data.callCount,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        averageLatency:
          data.latencies.length > 0
            ? Math.round(
                (data.latencies.reduce((a, b) => a + b, 0) /
                  data.latencies.length) *
                  100
              ) / 100
            : 0,
      }));

      const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

      return {
        period: { startDate, endDate },
        groupBy,
        totalCost: Math.round(totalCost * 10000) / 10000,
        items: items.sort((a, b) => b.cost - a.cost),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate cost report: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Export cost report to CSV
   * Property 40: 成本报告导出
   */
  async exportCostReportToCSV(report: CostReport): Promise<string> {
    try {
      const headers = [
        'Key',
        'Cost',
        'Call Count',
        'Input Tokens',
        'Output Tokens',
        'Average Latency (ms)',
      ];

      const rows = report.items.map((item) => [
        item.key,
        item.cost.toString(),
        item.callCount.toString(),
        item.inputTokens.toString(),
        item.outputTokens.toString(),
        item.averageLatency.toString(),
      ]);

      const csvContent = [
        `Report Period: ${report.period.startDate.toISOString()} to ${report.period.endDate.toISOString()}`,
        `Grouped By: ${report.groupBy}`,
        `Total Cost: ${report.totalCost}`,
        '',
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      return csvContent;
    } catch (error) {
      this.logger.error(
        `Failed to export cost report to CSV: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Export cost report to JSON
   * Property 40: 成本报告导出
   */
  async exportCostReportToJSON(report: CostReport): Promise<string> {
    try {
      return JSON.stringify(report, null, 2);
    } catch (error) {
      this.logger.error(
        `Failed to export cost report to JSON: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Set cost threshold for user
   * Property 38: 成本告警
   */
  setCostThreshold(userId: string, threshold: CostThreshold): void {
    this.costThresholds.set(userId, threshold);
    this.logger.log(`Set cost threshold for user ${userId}`);
  }

  /**
   * Get cost threshold for user
   */
  getCostThreshold(userId: string): CostThreshold | undefined {
    return this.costThresholds.get(userId);
  }

  /**
   * Check if cost exceeds threshold
   * Property 38: 成本告警
   */
  async checkCostThreshold(userId: string): Promise<boolean> {
    try {
      const threshold = this.costThresholds.get(userId);
      if (!threshold) {
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dailyRecords = await this.prisma.usageRecord.findMany({
        where: {
          userId,
          timestamp: {
            gte: today,
            lt: tomorrow,
          },
          success: true,
        },
      });

      const dailyCost = dailyRecords.reduce(
        (sum, record) => sum + record.cost,
        0
      );

      if (threshold.dailyLimit && dailyCost > threshold.dailyLimit) {
        this.logger.warn(
          `Daily cost threshold exceeded for user ${userId}: ${dailyCost} > ${threshold.dailyLimit}`
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check cost threshold: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get usage statistics for a model
   */
  async getModelUsageStats(
    model: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageLatency: number;
  }> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          model,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const successfulCalls = records.filter((r) => r.success).length;
      const failedCalls = records.filter((r) => !r.success).length;
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
      const totalInputTokens = records.reduce(
        (sum, r) => sum + r.inputTokens,
        0
      );
      const totalOutputTokens = records.reduce(
        (sum, r) => sum + r.outputTokens,
        0
      );
      const averageLatency =
        records.length > 0
          ? records.reduce((sum, r) => sum + r.latency, 0) / records.length
          : 0;

      return {
        totalCalls: records.length,
        successfulCalls,
        failedCalls,
        totalCost: Math.round(totalCost * 10000) / 10000,
        totalInputTokens,
        totalOutputTokens,
        averageLatency: Math.round(averageLatency * 100) / 100,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get model usage stats: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsageStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageLatency: number;
    modelBreakdown: Map<string, number>;
  }> {
    try {
      const records = await this.prisma.usageRecord.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const successfulCalls = records.filter((r) => r.success).length;
      const failedCalls = records.filter((r) => !r.success).length;
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
      const totalInputTokens = records.reduce(
        (sum, r) => sum + r.inputTokens,
        0
      );
      const totalOutputTokens = records.reduce(
        (sum, r) => sum + r.outputTokens,
        0
      );
      const averageLatency =
        records.length > 0
          ? records.reduce((sum, r) => sum + r.latency, 0) / records.length
          : 0;

      const modelBreakdown = new Map<string, number>();
      for (const record of records) {
        const current = modelBreakdown.get(record.model) || 0;
        modelBreakdown.set(record.model, current + record.cost);
      }

      return {
        totalCalls: records.length,
        successfulCalls,
        failedCalls,
        totalCost: Math.round(totalCost * 10000) / 10000,
        totalInputTokens,
        totalOutputTokens,
        averageLatency: Math.round(averageLatency * 100) / 100,
        modelBreakdown,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user usage stats: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Clean up old usage records
   */
  async cleanupOldRecords(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.usageRecord.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} usage records older than ${daysToKeep} days`
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old records: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Validate usage record
   */
  private validateUsageRecord(
    record: Omit<UsageRecord, 'id' | 'timestamp'>
  ): void {
    if (!record.userId || !record.userId.trim()) {
      throw new Error('User ID is required');
    }

    if (!record.model || !record.model.trim()) {
      throw new Error('Model is required');
    }

    if (!record.provider || !record.provider.trim()) {
      throw new Error('Provider is required');
    }

    if (record.inputTokens < 0) {
      throw new Error('Input tokens must be non-negative');
    }

    if (record.outputTokens < 0) {
      throw new Error('Output tokens must be non-negative');
    }

    if (record.cost < 0) {
      throw new Error('Cost must be non-negative');
    }

    if (record.latency < 0) {
      throw new Error('Latency must be non-negative');
    }
  }

  /**
   * Map Prisma UsageRecord to UsageRecord interface
   */
  private mapPrismaToUsageRecord(
    record: PrismaUsageRecord & { agentType?: string; workflowStep?: string }
  ): UsageRecord {
    return {
      id: record.id,
      userId: record.userId,
      model: record.model,
      provider: record.provider,
      scenario: record.scenario || undefined,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cost: record.cost,
      latency: record.latency,
      success: record.success,
      errorCode: record.errorCode || undefined,
      timestamp: record.timestamp,
      agentType: record.agentType || undefined,
      workflowStep: record.workflowStep || undefined,
    };
  }
}
