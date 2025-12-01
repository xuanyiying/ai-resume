import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';
import {
  InterviewQuestion,
  InterviewSession,
  InterviewMessage,
} from '@prisma/client';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EndSessionDto } from './dto/end-session.dto';

@Controller('interview')
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private interviewService: InterviewService) { }

  /**
   * Generate interview questions for an optimization
   * POST /api/v1/interview/questions
   */
  @Post('questions')
  @HttpCode(HttpStatus.CREATED)
  async generateQuestions(
    @Request() req: any,
    @Query('optimizationId') optimizationId: string,
    @Query('count') count?: string
  ): Promise<InterviewQuestion[]> {
    const userId = req.user.id;
    const questionCount = count ? parseInt(count, 10) : 12;

    return this.interviewService.generateQuestions(
      optimizationId,
      userId,
      questionCount
    );
  }

  /**
   * Get interview questions for an optimization
   * GET /api/v1/interview/questions/:optimizationId
   */
  @Get('questions/:optimizationId')
  async getQuestions(
    @Request() req: any,
    @Param('optimizationId') optimizationId: string
  ): Promise<InterviewQuestion[]> {
    const userId = req.user.id;

    return this.interviewService.getQuestions(optimizationId, userId);
  }

  /**
   * Export interview preparation as PDF
   * GET /api/v1/interview/export/:optimizationId
   */
  @Get('export/:optimizationId')
  async exportInterviewPrep(
    @Request() req: any,
    @Param('optimizationId') optimizationId: string
  ): Promise<{ html: string }> {
    const userId = req.user.id;

    const html = await this.interviewService.exportInterviewPrep(
      optimizationId,
      userId
    );

    return { html };
  }

  /**
   * Start a new interview session
   * POST /api/v1/interview/session
   */
  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  async startSession(
    @Request() req: any,
    @Body() createSessionDto: CreateSessionDto
  ): Promise<InterviewSession> {
    const userId = req.user.id;
    return this.interviewService.startSession(userId, createSessionDto);
  }

  /**
   * Send message in interview session
   * POST /api/v1/interview/session/:sessionId/message
   */
  @Post('session/:sessionId/message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() sendMessageDto: SendMessageDto
  ): Promise<{ userMessage: InterviewMessage; aiMessage: InterviewMessage }> {
    const userId = req.user.id;
    return this.interviewService.handleMessage(
      userId,
      sessionId,
      sendMessageDto
    );
  }

  /**
   * End interview session
   * POST /api/v1/interview/session/:sessionId/end
   */
  @Post('session/:sessionId/end')
  @HttpCode(HttpStatus.OK)
  async endSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string
  ): Promise<InterviewSession> {
    const userId = req.user.id;
    const endSessionDto: EndSessionDto = { sessionId };
    return this.interviewService.endSession(userId, endSessionDto);
  }

  /**
   * Get interview session details
   * GET /api/v1/interview/session/:sessionId
   */
  @Get('session/:sessionId')
  async getSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string
  ): Promise<InterviewSession> {
    const userId = req.user.id;
    return this.interviewService.getSession(userId, sessionId);
  }

  /**
   * Get active interview session for an optimization
   * GET /api/v1/interview/active-session/:optimizationId
   */
  @Get('active-session/:optimizationId')
  async getActiveSession(
    @Request() req: any,
    @Param('optimizationId') optimizationId: string
  ): Promise<InterviewSession | null> {
    const userId = req.user.id;
    return this.interviewService.getActiveSessionByOptimization(
      userId,
      optimizationId
    );
  }
}
