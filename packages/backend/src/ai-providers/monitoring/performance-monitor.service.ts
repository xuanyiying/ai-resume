/**
 * Performance Monitor Service
 * Monitors AI model performance metrics and generates alerts
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PerformanceMetrics as PrismaPerformanceMetrics } from '@prisma/client';

export interface PerformanceMetrics {
  id: string;
  model: string;
  provider: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  successRate: number;
  failureRate: number;
  lastUpdated: Date;
}

export interface Alert {
  id: string;
  model: string;
  provider: string;
  alertType: 'HIGH_FAILURE_RATE' | 'HIGH_LATENCY';
  threshold: number;
  currentValue: number;
  severity: 'WARNING' | 'CRITICAL';
  timestamp: Date;
}

export interface PerformanceAlert {
  model: string;
  provider: string;
  alertType: 'HIGH_FAILURE_RATE' | 'HIGH_LATENCY';
  threshold: number;
  currentValue: number;
  severity: 'WARNING' | 'CRITICAL';
}

export interface AgentThreshold {
  agentType: string;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyCostLimit?: number;
  monthlyCostLimit?: number;
}

export interface AgentAlert {
  agentType: string;
  alertType: 'EXCESSIVE_TOKEN_USAGE' | 'EXCESSIVE_COST';
  threshold: number;
  currentValue: number;
  severity: 'WARNING' | 'CRITICAL';
  period: 'daily' | 'monthly';
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);

  // Alert thresholds
  private readonly FAILURE_RATE_THRESHOLD = 0.1; // 10%
  private readonly LATENCY_THRESHOLD_MS = 30000; // 30 seconds

  // Agent-specific thresholds
  private agentThresholds: Map<string, AgentThreshold> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Record performance metrics for a model call
   * Property 41: 响应时间记录
   */
  async recordMetrics(
    model: string,
    provider: string,
    latency: number,
    success: boolean
  ): Promise<PerformanceMetrics> {
    try {
      // Validate input
      if (!model || !model.trim()) {
        throw new Error('Model is required');
      }

      if (!provider || !provider.trim()) {
        throw new Error('Provider is required');
      }

      if (latency < 0) {
        throw new Error('Latency must be non-negative');
      }

      // Get or create metrics record
      let metrics = await this.prisma.performanceMetrics.findUnique({
        where: { model },
      });

      if (!metrics) {
        metrics = await this.prisma.performanceMetrics.create({
          data: {
            model,
            provider,
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            averageLatency: 0,
            maxLatency: 0,
            minLatency: 0,
            successRate: 0,
            failureRate: 0,
          },
        });
      }

      // Update metrics
      const newTotalCalls = metrics.totalCalls + 1;
      const newSuccessfulCalls = success
        ? metrics.successfulCalls + 1
        : metrics.successfulCalls;
      const newFailedCalls = !success
        ? metrics.failedCalls + 1
        : metrics.failedCalls;

      // Calculate new average latency
      const newAverageLatency =
        (metrics.averageLatency * metrics.totalCalls + latency) / newTotalCalls;

      // Update max and min latency
      const newMaxLatency = Math.max(metrics.maxLatency, latency);
      const newMinLatency =
        metrics.minLatency === 0
          ? latency
          : Math.min(metrics.minLatency, latency);

      // Calculate success and failure rates
      const newSuccessRate = newSuccessfulCalls / newTotalCalls;
      const newFailureRate = newFailedCalls / newTotalCalls;

      const updated = await this.prisma.performanceMetrics.update({
        where: { model },
        data: {
          totalCalls: newTotalCalls,
          successfulCalls: newSuccessfulCalls,
          failedCalls: newFailedCalls,
          averageLatency: Math.round(newAverageLatency * 100) / 100,
          maxLatency: newMaxLatency,
          minLatency: newMinLatency,
          successRate: Math.round(newSuccessRate * 10000) / 10000,
          failureRate: Math.round(newFailureRate * 10000) / 10000,
          lastUpdated: new Date(),
        },
      });

      this.logger.debug(
        `Recorded metrics for model ${model}: latency=${latency}ms, success=${success}`
      );

      return this.mapPrismaToMetrics(updated);
    } catch (error) {
      this.logger.error(
        `Failed to record metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get performance metrics for a model
   * Property 42: 性能指标计算
   */
  async getMetrics(
    model: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceMetrics | null> {
    try {
      if (!model || !model.trim()) {
        throw new Error('Model is required');
      }

      const metrics = await this.prisma.performanceMetrics.findUnique({
        where: { model },
      });

      if (!metrics) {
        return null;
      }

      // If date range is provided, calculate metrics for that range
      if (startDate && endDate) {
        return this.calculateMetricsForDateRange(model, startDate, endDate);
      }

      return this.mapPrismaToMetrics(metrics);
    } catch (error) {
      this.logger.error(
        `Failed to get metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get metrics for all models
   */
  async getAllMetrics(): Promise<PerformanceMetrics[]> {
    try {
      const metrics = await this.prisma.performanceMetrics.findMany();
      return metrics.map((m) => this.mapPrismaToMetrics(m));
    } catch (error) {
      this.logger.error(
        `Failed to get all metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get metrics for a provider
   */
  async getMetricsByProvider(provider: string): Promise<PerformanceMetrics[]> {
    try {
      if (!provider || !provider.trim()) {
        throw new Error('Provider is required');
      }

      const metrics = await this.prisma.performanceMetrics.findMany({
        where: { provider },
      });

      return metrics.map((m) => this.mapPrismaToMetrics(m));
    } catch (error) {
      this.logger.error(
        `Failed to get metrics by provider: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Check for alerts
   * Property 44: 失败率告警
   * Property 45: 响应时间告警
   */
  async checkAlerts(): Promise<PerformanceAlert[]> {
    try {
      const alerts: PerformanceAlert[] = [];
      const metrics = await this.prisma.performanceMetrics.findMany();

      for (const metric of metrics) {
        // Check failure rate threshold
        if (metric.failureRate > this.FAILURE_RATE_THRESHOLD) {
          alerts.push({
            model: metric.model,
            provider: metric.provider,
            alertType: 'HIGH_FAILURE_RATE',
            threshold: this.FAILURE_RATE_THRESHOLD,
            currentValue: metric.failureRate,
            severity: metric.failureRate > 0.2 ? 'CRITICAL' : 'WARNING',
          });

          this.logger.warn(
            `High failure rate alert for model ${metric.model}: ${(metric.failureRate * 100).toFixed(2)}%`
          );
        }

        // Check latency threshold
        if (metric.averageLatency > this.LATENCY_THRESHOLD_MS) {
          alerts.push({
            model: metric.model,
            provider: metric.provider,
            alertType: 'HIGH_LATENCY',
            threshold: this.LATENCY_THRESHOLD_MS,
            currentValue: metric.averageLatency,
            severity: metric.averageLatency > 60000 ? 'CRITICAL' : 'WARNING',
          });

          this.logger.warn(
            `High latency alert for model ${metric.model}: ${metric.averageLatency.toFixed(2)}ms`
          );
        }
      }

      return alerts;
    } catch (error) {
      this.logger.error(
        `Failed to check alerts: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get alerts for a specific model
   */
  async getAlertsForModel(model: string): Promise<PerformanceAlert[]> {
    try {
      if (!model || !model.trim()) {
        throw new Error('Model is required');
      }

      const metrics = await this.prisma.performanceMetrics.findUnique({
        where: { model },
      });

      if (!metrics) {
        return [];
      }

      const alerts: PerformanceAlert[] = [];

      if (metrics.failureRate > this.FAILURE_RATE_THRESHOLD) {
        alerts.push({
          model: metrics.model,
          provider: metrics.provider,
          alertType: 'HIGH_FAILURE_RATE',
          threshold: this.FAILURE_RATE_THRESHOLD,
          currentValue: metrics.failureRate,
          severity: metrics.failureRate > 0.2 ? 'CRITICAL' : 'WARNING',
        });
      }

      if (metrics.averageLatency > this.LATENCY_THRESHOLD_MS) {
        alerts.push({
          model: metrics.model,
          provider: metrics.provider,
          alertType: 'HIGH_LATENCY',
          threshold: this.LATENCY_THRESHOLD_MS,
          currentValue: metrics.averageLatency,
          severity: metrics.averageLatency > 60000 ? 'CRITICAL' : 'WARNING',
        });
      }

      return alerts;
    } catch (error) {
      this.logger.error(
        `Failed to get alerts for model: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Reset metrics for a model
   */
  async resetMetrics(model: string): Promise<PerformanceMetrics> {
    try {
      if (!model || !model.trim()) {
        throw new Error('Model is required');
      }

      const metrics = await this.prisma.performanceMetrics.findUnique({
        where: { model },
      });

      if (!metrics) {
        throw new Error(`Metrics not found for model ${model}`);
      }

      const reset = await this.prisma.performanceMetrics.update({
        where: { model },
        data: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageLatency: 0,
          maxLatency: 0,
          minLatency: 0,
          successRate: 0,
          failureRate: 0,
          lastUpdated: new Date(),
        },
      });

      this.logger.log(`Reset metrics for model ${model}`);

      return this.mapPrismaToMetrics(reset);
    } catch (error) {
      this.logger.error(
        `Failed to reset metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Calculate metrics for a date range
   * Property 46: 性能指标查询
   */
  private async calculateMetricsForDateRange(
    model: string,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
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

      if (records.length === 0) {
        return {
          id: '',
          model,
          provider: '',
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageLatency: 0,
          maxLatency: 0,
          minLatency: 0,
          successRate: 0,
          failureRate: 0,
          lastUpdated: new Date(),
        };
      }

      const successfulCalls = records.filter((r) => r.success).length;
      const failedCalls = records.filter((r) => !r.success).length;
      const latencies = records.map((r) => r.latency);
      const averageLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      const successRate = successfulCalls / records.length;
      const failureRate = failedCalls / records.length;

      const metrics = await this.prisma.performanceMetrics.findUnique({
        where: { model },
      });

      return {
        id: metrics?.id || '',
        model,
        provider: metrics?.provider || '',
        totalCalls: records.length,
        successfulCalls,
        failedCalls,
        averageLatency: Math.round(averageLatency * 100) / 100,
        maxLatency,
        minLatency,
        successRate: Math.round(successRate * 10000) / 10000,
        failureRate: Math.round(failureRate * 10000) / 10000,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate metrics for date range: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Set Agent threshold
   * Property 39: Threshold Alert Triggering
   */
  setAgentThreshold(agentType: string, threshold: AgentThreshold): void {
    this.agentThresholds.set(agentType, threshold);
    this.logger.log(`Set Agent threshold for ${agentType}`);
  }

  /**
   * Get Agent threshold
   */
  getAgentThreshold(agentType: string): AgentThreshold | undefined {
    return this.agentThresholds.get(agentType);
  }

  /**
   * Check Agent thresholds and generate alerts
   * Property 39: Threshold Alert Triggering
   */
  async checkAgentThresholds(
    agentType: string,
    userId: string
  ): Promise<AgentAlert[]> {
    try {
      const threshold = this.agentThresholds.get(agentType);
      if (!threshold) {
        return [];
      }

      const alerts: AgentAlert[] = [];

      // Check daily token limit
      if (threshold.dailyTokenLimit) {
        const dailyTokens = await this.getAgentDailyTokenUsage(
          agentType,
          userId
        );
        if (dailyTokens > threshold.dailyTokenLimit) {
          alerts.push({
            agentType,
            alertType: 'EXCESSIVE_TOKEN_USAGE',
            threshold: threshold.dailyTokenLimit,
            currentValue: dailyTokens,
            severity: dailyTokens > threshold.dailyTokenLimit * 1.5 ? 'CRITICAL' : 'WARNING',
            period: 'daily',
          });

          this.logger.warn(
            `Daily token limit exceeded for Agent ${agentType}: ${dailyTokens} > ${threshold.dailyTokenLimit}`
          );
        }
      }

      // Check monthly token limit
      if (threshold.monthlyTokenLimit) {
        const monthlyTokens = await this.getAgentMonthlyTokenUsage(
          agentType,
          userId
        );
        if (monthlyTokens > threshold.monthlyTokenLimit) {
          alerts.push({
            agentType,
            alertType: 'EXCESSIVE_TOKEN_USAGE',
            threshold: threshold.monthlyTokenLimit,
            currentValue: monthlyTokens,
            severity: monthlyTokens > threshold.monthlyTokenLimit * 1.5 ? 'CRITICAL' : 'WARNING',
            period: 'monthly',
          });

          this.logger.warn(
            `Monthly token limit exceeded for Agent ${agentType}: ${monthlyTokens} > ${threshold.monthlyTokenLimit}`
          );
        }
      }

      // Check daily cost limit
      if (threshold.dailyCostLimit) {
        const dailyCost = await this.getAgentDailyCost(agentType, userId);
        if (dailyCost > threshold.dailyCostLimit) {
          alerts.push({
            agentType,
            alertType: 'EXCESSIVE_COST',
            threshold: threshold.dailyCostLimit,
            currentValue: dailyCost,
            severity: dailyCost > threshold.dailyCostLimit * 1.5 ? 'CRITICAL' : 'WARNING',
            period: 'daily',
          });

          this.logger.warn(
            `Daily cost limit exceeded for Agent ${agentType}: ${dailyCost} > ${threshold.dailyCostLimit}`
          );
        }
      }

      // Check monthly cost limit
      if (threshold.monthlyCostLimit) {
        const monthlyCost = await this.getAgentMonthlyCost(agentType, userId);
        if (monthlyCost > threshold.monthlyCostLimit) {
          alerts.push({
            agentType,
            alertType: 'EXCESSIVE_COST',
            threshold: threshold.monthlyCostLimit,
            currentValue: monthlyCost,
            severity: monthlyCost > threshold.monthlyCostLimit * 1.5 ? 'CRITICAL' : 'WARNING',
            period: 'monthly',
          });

          this.logger.warn(
            `Monthly cost limit exceeded for Agent ${agentType}: ${monthlyCost} > ${threshold.monthlyCostLimit}`
          );
        }
      }

      return alerts;
    } catch (error) {
      this.logger.error(
        `Failed to check Agent thresholds: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get daily token usage for Agent
   */
  private async getAgentDailyTokenUsage(
    agentType: string,
    userId: string
  ): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const records = await this.prisma.usageRecord.findMany({
        where: {
          userId,
          agentType,
          timestamp: {
            gte: today,
            lt: tomorrow,
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
        `Failed to get daily token usage: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get monthly token usage for Agent
   */
  private async getAgentMonthlyTokenUsage(
    agentType: string,
    userId: string
  ): Promise<number> {
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const records = await this.prisma.usageRecord.findMany({
        where: {
          userId,
          agentType,
          timestamp: {
            gte: firstDay,
            lte: lastDay,
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
        `Failed to get monthly token usage: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get daily cost for Agent
   */
  private async getAgentDailyCost(
    agentType: string,
    userId: string
  ): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const records = await this.prisma.usageRecord.findMany({
        where: {
          userId,
          agentType,
          timestamp: {
            gte: today,
            lt: tomorrow,
          },
          success: true,
        },
      });

      return records.reduce((sum, r) => sum + r.cost, 0);
    } catch (error) {
      this.logger.error(
        `Failed to get daily cost: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get monthly cost for Agent
   */
  private async getAgentMonthlyCost(
    agentType: string,
    userId: string
  ): Promise<number> {
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const records = await this.prisma.usageRecord.findMany({
        where: {
          userId,
          agentType,
          timestamp: {
            gte: firstDay,
            lte: lastDay,
          },
          success: true,
        },
      });

      return records.reduce((sum, r) => sum + r.cost, 0);
    } catch (error) {
      this.logger.error(
        `Failed to get monthly cost: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Map Prisma PerformanceMetrics to PerformanceMetrics interface
   */
  private mapPrismaToMetrics(
    metrics: PrismaPerformanceMetrics
  ): PerformanceMetrics {
    return {
      id: metrics.id,
      model: metrics.model,
      provider: metrics.provider,
      totalCalls: metrics.totalCalls,
      successfulCalls: metrics.successfulCalls,
      failedCalls: metrics.failedCalls,
      averageLatency: metrics.averageLatency,
      maxLatency: metrics.maxLatency,
      minLatency: metrics.minLatency,
      successRate: metrics.successRate,
      failureRate: metrics.failureRate,
      lastUpdated: metrics.lastUpdated,
    };
  }
}
