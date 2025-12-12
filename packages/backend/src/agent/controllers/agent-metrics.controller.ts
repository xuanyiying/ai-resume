import {
  Controller,
  Get,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../user/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageTrackerService } from '../../ai-providers/tracking/usage-tracker.service';

/**
 * Token Usage Report Item
 */
export interface TokenUsageReportItem {
  key: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  averageTokensPerCall: number;
}

/**
 * Token Usage Report
 */
export interface TokenUsageReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  groupBy: 'agent-type' | 'workflow-step' | 'model';
  totalTokens: number;
  items: TokenUsageReportItem[];
}

/**
 * Cost Report Item
 */
export interface CostReportItem {
  key: string;
  cost: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  averageCostPerCall: number;
}

/**
 * Cost Report
 */
export interface CostReportResponse {
  period: {
    startDate: Date;
    endDate: Date;
  };
  groupBy: 'agent-type' | 'workflow-step' | 'model';
  totalCost: number;
  items: CostReportItem[];
}

/**
 * Optimization Savings Report
 */
export interface OptimizationSavingsReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalSavingsFromCaching: number;
  totalSavingsFromCompression: number;
  totalSavingsFromModelRouting: number;
  totalSavings: number;
  savingsPercentage: number;
}

/**
 * Agent Metrics Controller
 * Handles HTTP requests for Agent metrics and reporting
 * Requirements: 10.2, 10.3
 */
@Controller('api/agents/metrics')
@UseGuards(JwtAuthGuard)
export class AgentMetricsController {
  private readonly logger = new Logger(AgentMetricsController.name);

  constructor(
    private prisma: PrismaService,
    private usageTracker: UsageTrackerService
  ) {}

  /**
   * Get token usage report
   * GET /api/agents/metrics/token-usage
   * Query params: startDate, endDate, groupBy (agent-type|workflow-step|model), agentType (optional)
   */
  @Get('token-usage')
  async getTokenUsageReport(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Query('groupBy')
    groupBy: 'agent-type' | 'workflow-step' | 'model' = 'agent-type',
    @Query('agentType') agentType?: string,
    @Request() _req?: { user: { id: string } }
  ): Promise<TokenUsageReport> {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(
        `Getting token usage report from ${startDate} to ${endDate}, groupBy: ${groupBy}`
      );

      // Query usage records
      const records = await (this.prisma as any).usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(agentType && { agentType }),
          success: true,
        },
      });

      // Group records based on groupBy parameter
      const groupedData = new Map<
        string,
        {
          totalTokens: number;
          inputTokens: number;
          outputTokens: number;
          callCount: number;
        }
      >();

      for (const record of records as any[]) {
        let key: string;

        if (groupBy === 'agent-type') {
          key = record.agentType || 'unknown';
        } else if (groupBy === 'workflow-step') {
          key = record.workflowStep || 'unknown';
        } else {
          key = record.model;
        }

        const current = groupedData.get(key) || {
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          callCount: 0,
        };

        current.totalTokens += record.inputTokens + record.outputTokens;
        current.inputTokens += record.inputTokens;
        current.outputTokens += record.outputTokens;
        current.callCount += 1;

        groupedData.set(key, current);
      }

      // Convert to report items
      const items: TokenUsageReportItem[] = Array.from(
        groupedData.entries()
      ).map(([key, data]) => ({
        key,
        totalTokens: data.totalTokens,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        callCount: data.callCount,
        averageTokensPerCall:
          data.callCount > 0
            ? Math.round(data.totalTokens / data.callCount)
            : 0,
      }));

      const totalTokens = items.reduce(
        (sum, item) => sum + item.totalTokens,
        0
      );

      return {
        period: { startDate, endDate },
        groupBy,
        totalTokens,
        items,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get token usage report: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get token usage report',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get cost report
   * GET /api/agents/metrics/cost
   * Query params: startDate, endDate, groupBy (agent-type|workflow-step|model), agentType (optional)
   */
  @Get('cost')
  async getCostReport(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Query('groupBy')
    groupBy: 'agent-type' | 'workflow-step' | 'model' = 'agent-type',
    @Query('agentType') agentType?: string,
    @Request() _req?: { user: { id: string } }
  ): Promise<CostReportResponse> {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(
        `Getting cost report from ${startDate} to ${endDate}, groupBy: ${groupBy}`
      );

      // Query usage records
      const records = await (this.prisma as any).usageRecord.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(agentType && { agentType }),
          success: true,
        },
      });

      // Group records based on groupBy parameter
      const groupedData = new Map<
        string,
        {
          cost: number;
          inputTokens: number;
          outputTokens: number;
          callCount: number;
        }
      >();

      for (const record of records as any[]) {
        let key: string;

        if (groupBy === 'agent-type') {
          key = record.agentType || 'unknown';
        } else if (groupBy === 'workflow-step') {
          key = record.workflowStep || 'unknown';
        } else {
          key = record.model;
        }

        const current = groupedData.get(key) || {
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          callCount: 0,
        };

        current.cost += record.cost;
        current.inputTokens += record.inputTokens;
        current.outputTokens += record.outputTokens;
        current.callCount += 1;

        groupedData.set(key, current);
      }

      // Convert to report items
      const items: CostReportItem[] = Array.from(groupedData.entries()).map(
        ([key, data]) => ({
          key,
          cost: Math.round(data.cost * 10000) / 10000, // Round to 4 decimal places
          callCount: data.callCount,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          averageCostPerCall:
            data.callCount > 0
              ? Math.round((data.cost / data.callCount) * 10000) / 10000
              : 0,
        })
      );

      const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

      return {
        period: { startDate, endDate },
        groupBy,
        totalCost: Math.round(totalCost * 10000) / 10000,
        items,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get cost report: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get cost report',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get optimization savings report
   * GET /api/agents/metrics/optimization-savings
   * Query params: startDate, endDate, agentType (optional)
   */
  @Get('optimization-savings')
  async getOptimizationSavingsReport(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Query('agentType') agentType?: string,
    @Request() _req?: { user: { id: string } }
  ): Promise<OptimizationSavingsReport> {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(
        `Getting optimization savings report from ${startDate} to ${endDate}`
      );

      // Query agent sessions to calculate savings
      const sessions = await (this.prisma as any).agentSession.findMany({
        where: {
          startedAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(agentType && { agentType }),
          status: 'completed',
        },
      });

      let totalSavingsFromCaching = 0;
      let totalSavingsFromCompression = 0;
      let totalSavingsFromModelRouting = 0;

      for (const session of sessions) {
        if (session.metadata && typeof session.metadata === 'object') {
          const metadata = session.metadata as any;

          if (metadata.savingsFromCaching) {
            totalSavingsFromCaching += metadata.savingsFromCaching;
          }
          if (metadata.savingsFromCompression) {
            totalSavingsFromCompression += metadata.savingsFromCompression;
          }
          if (metadata.savingsFromModelRouting) {
            totalSavingsFromModelRouting += metadata.savingsFromModelRouting;
          }
        }
      }

      const totalSavings =
        totalSavingsFromCaching +
        totalSavingsFromCompression +
        totalSavingsFromModelRouting;

      // Calculate total tokens that would have been used without optimization
      const totalTokensWithoutOptimization =
        totalSavings + this.calculateTotalTokensUsed(sessions);
      const savingsPercentage =
        totalTokensWithoutOptimization > 0
          ? Math.round(
              (totalSavings / totalTokensWithoutOptimization) * 100 * 100
            ) / 100
          : 0;

      return {
        period: { startDate, endDate },
        totalSavingsFromCaching,
        totalSavingsFromCompression,
        totalSavingsFromModelRouting,
        totalSavings,
        savingsPercentage,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get optimization savings report: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get optimization savings report',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Helper method to calculate total tokens used in sessions
   */
  private calculateTotalTokensUsed(sessions: any[]): number {
    let total = 0;

    for (const session of sessions) {
      if (session.tokenUsage && typeof session.tokenUsage === 'object') {
        const tokenUsage = session.tokenUsage;
        if (tokenUsage.total) {
          total += tokenUsage.total;
        }
      }
    }

    return total;
  }
}
