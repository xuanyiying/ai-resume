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

/**
 * Agent Status Response
 */
export interface AgentStatusResponse {
  agentType: string;
  displayName: string;
  description: string;
  isAvailable: boolean;
  lastUsed?: Date;
  totalSessions: number;
}

/**
 * Agent Metrics Response
 */
export interface AgentMetricsResponse {
  agentType: string;
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  averageTokensPerSession: number;
  totalTokensUsed: number;
  totalCost: number;
  successRate: number;
}

/**
 * Agent Management Controller
 * Handles HTTP requests for Agent management and monitoring
 * Requirements: 10.2
 */
@Controller('api/agents/management')
@UseGuards(JwtAuthGuard)
export class AgentManagementController {
  private readonly logger = new Logger(AgentManagementController.name);

  private readonly AVAILABLE_AGENTS = [
    {
      type: 'pitch-perfect',
      displayName: 'Pitch Perfect',
      description: 'Personal introduction optimization for job interviews',
    },
    {
      type: 'strategist',
      displayName: 'Strategist',
      description: 'Interview question bank generation and customization',
    },
    {
      type: 'role-play',
      displayName: 'Role-Play',
      description: 'Mock interview simulation with real-time feedback',
    },
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * List available Agents
   * GET /api/agents/management/list
   */
  @Get('list')
  async listAgents(): Promise<AgentStatusResponse[]> {
    try {
      this.logger.log('Listing available agents');

      const agents: AgentStatusResponse[] = this.AVAILABLE_AGENTS.map(
        (agent) => ({
          agentType: agent.type,
          displayName: agent.displayName,
          description: agent.description,
          isAvailable: true,
          totalSessions: 0,
        })
      );

      return agents;
    } catch (error) {
      this.logger.error(
        `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to list agents',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get Agent status
   * GET /api/agents/management/status/:agentType
   */
  @Get('status')
  async getAgentStatus(
    @Query('agentType') agentType: string,
    @Request() req: { user: { id: string } }
  ): Promise<AgentStatusResponse> {
    try {
      this.logger.log(`Getting status for agent: ${agentType}`);

      const agent = this.AVAILABLE_AGENTS.find((a) => a.type === agentType);

      if (!agent) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Agent type '${agentType}' not found`,
          },
          HttpStatus.NOT_FOUND
        );
      }

      // Get last used date and total sessions for this user
      const lastSession = await (this.prisma as any).agentSession.findFirst({
        where: {
          userId: req.user.id,
          agentType,
        },
        orderBy: {
          completedAt: 'desc',
        },
      });

      const totalSessions = await (this.prisma as any).agentSession.count({
        where: {
          userId: req.user.id,
          agentType,
        },
      });

      return {
        agentType: agent.type,
        displayName: agent.displayName,
        description: agent.description,
        isAvailable: true,
        lastUsed: lastSession?.completedAt || undefined,
        totalSessions,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get agent status: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get agent status',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * View Agent metrics
   * GET /api/agents/management/metrics/:agentType
   */
  @Get('metrics')
  async viewAgentMetrics(
    @Query('agentType') agentType: string,
    @Request() req: { user: { id: string } }
  ): Promise<AgentMetricsResponse> {
    try {
      this.logger.log(`Getting metrics for agent: ${agentType}`);

      const agent = this.AVAILABLE_AGENTS.find((a) => a.type === agentType);

      if (!agent) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Agent type '${agentType}' not found`,
          },
          HttpStatus.NOT_FOUND
        );
      }

      // Get all sessions for this user and agent type
      const sessions = await (this.prisma as any).agentSession.findMany({
        where: {
          userId: req.user.id,
          agentType,
        },
      });

      const totalSessions = sessions.length;
      const successfulSessions = sessions.filter(
        (s) => s.status === 'completed'
      ).length;
      const failedSessions = sessions.filter(
        (s) => s.status === 'failed'
      ).length;

      // Calculate token usage
      let totalTokensUsed = 0;
      let totalCost = 0;

      for (const session of sessions) {
        if (session.tokenUsage && typeof session.tokenUsage === 'object') {
          const tokenUsage = session.tokenUsage;
          if (tokenUsage.total) {
            totalTokensUsed += tokenUsage.total;
          }
        }
        totalCost += session.cost || 0;
      }

      const averageTokensPerSession =
        totalSessions > 0 ? Math.round(totalTokensUsed / totalSessions) : 0;
      const successRate =
        totalSessions > 0
          ? Math.round((successfulSessions / totalSessions) * 100)
          : 0;

      return {
        agentType,
        totalSessions,
        successfulSessions,
        failedSessions,
        averageTokensPerSession,
        totalTokensUsed,
        totalCost,
        successRate,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get agent metrics: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get agent metrics',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
