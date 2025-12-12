import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
  Query,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../user/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Agent Session Summary
 */
export interface AgentSessionSummary {
  id: string;
  agentType: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in milliseconds
  tokenUsage?: {
    total: number;
    byStep?: Record<string, number>;
  };
  cost: number;
}

/**
 * Agent Session Details
 */
export interface AgentSessionDetails {
  id: string;
  agentType: string;
  status: string;
  input: any;
  output: any;
  tokenUsage?: {
    total: number;
    byStep?: Record<string, number>;
  };
  cost: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata?: any;
}

/**
 * Agent Session Management Controller
 * Handles HTTP requests for Agent session management
 * Requirements: 8.4
 */
@Controller('api/agents/sessions')
@UseGuards(JwtAuthGuard)
export class AgentSessionController {
  private readonly logger = new Logger(AgentSessionController.name);

  constructor(private prisma: PrismaService) {}

  /**
   * List user's Agent sessions
   * GET /api/agents/sessions
   * Query params: agentType (optional), status (optional), limit, offset
   */
  @Get()
  async listUserSessions(
    @Query('agentType') agentType?: string,
    @Query('status') status?: string,
    @Query('limit') limitStr: string = '20',
    @Query('offset') offsetStr: string = '0',
    @Request() req?: { user: { id: string } }
  ): Promise<{
    sessions: AgentSessionSummary[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const limit = Math.min(parseInt(limitStr, 10) || 20, 100);
      const offset = parseInt(offsetStr, 10) || 0;

      if (limit < 1 || offset < 0) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid limit or offset',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(
        `Listing sessions for user ${req?.user?.id}, agentType: ${agentType}, status: ${status}`
      );

      // Count total sessions
      const total = await (this.prisma as any).agentSession.count({
        where: {
          userId: req?.user?.id,
          ...(agentType && { agentType }),
          ...(status && { status }),
        },
      });

      // Fetch sessions
      const sessions = await (this.prisma as any).agentSession.findMany({
        where: {
          userId: req?.user?.id,
          ...(agentType && { agentType }),
          ...(status && { status }),
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: limit,
        skip: offset,
      });

      const summaries: AgentSessionSummary[] = sessions.map((session) => ({
        id: session.id,
        agentType: session.agentType,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt || undefined,
        duration: session.completedAt
          ? session.completedAt.getTime() - session.startedAt.getTime()
          : undefined,
        tokenUsage: session.tokenUsage as any,
        cost: session.cost,
      }));

      return {
        sessions: summaries,
        total,
        limit,
        offset,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to list sessions',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get session details
   * GET /api/agents/sessions/:sessionId
   */
  @Get(':sessionId')
  async getSessionDetails(
    @Param('sessionId') sessionId: string,
    @Request() req?: { user: { id: string } }
  ): Promise<AgentSessionDetails> {
    try {
      this.logger.log(`Getting details for session ${sessionId}`);

      const session = await (this.prisma as any).agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Session ${sessionId} not found`,
          },
          HttpStatus.NOT_FOUND
        );
      }

      // Verify ownership
      if (session.userId !== req?.user?.id) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            message: 'You do not have permission to access this session',
          },
          HttpStatus.FORBIDDEN
        );
      }

      return {
        id: session.id,
        agentType: session.agentType,
        status: session.status,
        input: session.input,
        output: session.output,
        tokenUsage: session.tokenUsage as any,
        cost: session.cost,
        startedAt: session.startedAt,
        completedAt: session.completedAt || undefined,
        duration: session.completedAt
          ? session.completedAt.getTime() - session.startedAt.getTime()
          : undefined,
        metadata: session.metadata,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get session details: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get session details',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Cancel running session
   * POST /api/agents/sessions/:sessionId/cancel
   */
  @Post(':sessionId/cancel')
  async cancelSession(
    @Param('sessionId') sessionId: string,
    @Request() req?: { user: { id: string } }
  ): Promise<{ message: string; session: AgentSessionDetails }> {
    try {
      this.logger.log(`Cancelling session ${sessionId}`);

      const session = await (this.prisma as any).agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Session ${sessionId} not found`,
          },
          HttpStatus.NOT_FOUND
        );
      }

      // Verify ownership
      if (session.userId !== req?.user?.id) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            message: 'You do not have permission to cancel this session',
          },
          HttpStatus.FORBIDDEN
        );
      }

      // Check if session is still active
      if (session.status !== 'active') {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Cannot cancel session with status '${session.status}'`,
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Update session status to failed
      const updatedSession = await (this.prisma as any).agentSession.update({
        where: { id: sessionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          metadata: {
            ...(session.metadata as any),
            cancelledBy: req?.user?.id,
            cancelledAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`Successfully cancelled session ${sessionId}`);

      return {
        message: 'Session cancelled successfully',
        session: {
          id: updatedSession.id,
          agentType: updatedSession.agentType,
          status: updatedSession.status,
          input: updatedSession.input,
          output: updatedSession.output,
          tokenUsage: updatedSession.tokenUsage,
          cost: updatedSession.cost,
          startedAt: updatedSession.startedAt,
          completedAt: updatedSession.completedAt || undefined,
          duration: updatedSession.completedAt
            ? updatedSession.completedAt.getTime() -
              updatedSession.startedAt.getTime()
            : undefined,
          metadata: updatedSession.metadata,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to cancel session: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to cancel session',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
