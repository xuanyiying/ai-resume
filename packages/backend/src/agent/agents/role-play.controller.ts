import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../user/guards/jwt-auth.guard';
import {
  RolePlayAgent,
  RolePlayAgentConfig,
  RolePlayAgentState,
  InterviewFeedback,
} from './role-play.agent';
import { ParsedResumeData } from '../../types';

/**
 * Request DTO for starting interview
 */
export interface StartInterviewRequest {
  jobDescription: string;
  interviewerStyle: 'strict' | 'friendly' | 'stress-test';
  focusAreas: string[];
  resumeData?: ParsedResumeData;
}

/**
 * Request DTO for processing user response
 */
export interface ProcessResponseRequest {
  sessionId: string;
  userResponse: string;
}

/**
 * Request DTO for concluding interview
 */
export interface ConcludeInterviewRequest {
  sessionId: string;
}

/**
 * Role-Play Agent Controller
 * Handles HTTP requests for mock interview simulation
 * Requirements: 4.1-4.7
 */
@Controller('api/agents/role-play')
@UseGuards(JwtAuthGuard)
export class RolePlayController {
  private readonly logger = new Logger(RolePlayController.name);

  constructor(private rolePlayAgent: RolePlayAgent) {}

  /**
   * Start a new mock interview session
   * POST /api/agents/role-play/start
   */
  @Post('start')
  async startInterview(
    @Body() request: StartInterviewRequest,
    @Request() req: { user: { id: string } }
  ): Promise<RolePlayAgentState> {
    try {
      this.logger.log(
        `Starting interview for user ${req.user.id} with style ${request.interviewerStyle}`
      );

      const config: RolePlayAgentConfig = {
        jobDescription: request.jobDescription,
        interviewerStyle: request.interviewerStyle,
        focusAreas: request.focusAreas,
        resumeData: request.resumeData,
      };

      const state = await this.rolePlayAgent.startInterview(
        config,
        req.user.id
      );

      this.logger.log(
        `Interview session ${state.sessionId} started for user ${req.user.id}`
      );

      return state;
    } catch (error) {
      this.logger.error(
        `Failed to start interview: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to start interview',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process user response and generate follow-up
   * POST /api/agents/role-play/respond
   */
  @Post('respond')
  async processResponse(
    @Body() request: ProcessResponseRequest,
    @Request() req: { user: { id: string } }
  ): Promise<{
    followUpQuestion: string;
    realTimeAnalysis: {
      keywords: string[];
      sentiment: string;
      suggestions: string[];
      relevanceScore: number;
    };
  }> {
    try {
      this.logger.debug(
        `Processing response for session ${request.sessionId} from user ${req.user.id}`
      );

      const result = await this.rolePlayAgent.processUserResponse(
        request.sessionId,
        request.userResponse,
        req.user.id
      );

      this.logger.debug(
        `Successfully processed response for session ${request.sessionId}`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process response: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to process response',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Conclude interview and generate feedback
   * POST /api/agents/role-play/conclude
   */
  @Post('conclude')
  async concludeInterview(
    @Body() request: ConcludeInterviewRequest,
    @Request() req: { user: { id: string } }
  ): Promise<InterviewFeedback> {
    try {
      this.logger.log(
        `Concluding interview session ${request.sessionId} for user ${req.user.id}`
      );

      const feedback = await this.rolePlayAgent.concludeInterview(
        request.sessionId,
        req.user.id
      );

      this.logger.log(
        `Interview session ${request.sessionId} concluded for user ${req.user.id}`
      );

      return feedback;
    } catch (error) {
      this.logger.error(
        `Failed to conclude interview: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to conclude interview',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get interview feedback
   * GET /api/agents/role-play/feedback/:sessionId
   */
  @Get('feedback/:sessionId')
  async getFeedback(
    @Param('sessionId') sessionId: string,
    @Request() req: { user: { id: string } }
  ): Promise<InterviewFeedback> {
    try {
      this.logger.debug(
        `Retrieving feedback for session ${sessionId} for user ${req.user.id}`
      );

      // In a real implementation, you would retrieve from database
      // For now, we'll return a placeholder
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Feedback not found',
        },
        HttpStatus.NOT_FOUND
      );
    } catch (error) {
      this.logger.error(
        `Failed to get feedback: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to get feedback',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
