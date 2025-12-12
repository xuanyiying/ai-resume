import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../user/guards/jwt-auth.guard';
import {
  PitchPerfectAgent,
  PitchPerfectAgentInput,
  PitchPerfectAgentOutput,
} from './pitch-perfect.agent';
import { ParsedResumeData } from '../../types';

/**
 * Request DTO for pitch generation
 */
export interface GeneratePitchRequest {
  resumeData: ParsedResumeData;
  jobDescription: string;
  style: 'technical' | 'managerial' | 'sales';
  duration: 30 | 60;
}

/**
 * Request DTO for pitch refinement
 */
export interface RefinePitchRequest {
  currentIntroduction: string;
  feedback: string;
}

/**
 * Pitch Perfect Agent Controller
 * Handles HTTP requests for personal introduction optimization
 * Requirements: 2.1-2.7
 */
@Controller('api/agents/pitch-perfect')
@UseGuards(JwtAuthGuard)
export class PitchPerfectController {
  private readonly logger = new Logger(PitchPerfectController.name);

  constructor(private pitchPerfectAgent: PitchPerfectAgent) {}

  /**
   * Generate optimized introduction
   * POST /api/agents/pitch-perfect/generate
   */
  @Post('generate')
  async generatePitch(
    @Body() request: GeneratePitchRequest,
    @Request() req: { user: { id: string } }
  ): Promise<PitchPerfectAgentOutput> {
    try {
      this.logger.log(
        `Generating pitch for user ${req.user.id} with style ${request.style}`
      );

      const input: PitchPerfectAgentInput = {
        resumeData: request.resumeData,
        jobDescription: request.jobDescription,
        style: request.style,
        duration: request.duration,
      };

      const result = await this.pitchPerfectAgent.generate(input, req.user.id);

      this.logger.log(`Successfully generated pitch for user ${req.user.id}`);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate pitch: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to generate pitch',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Refine introduction based on feedback
   * POST /api/agents/pitch-perfect/refine
   */
  @Post('refine')
  async refinePitch(
    @Body() request: RefinePitchRequest,
    @Request() req: { user: { id: string } }
  ): Promise<{ refinedIntroduction: string }> {
    try {
      this.logger.log(`Refining pitch for user ${req.user.id}`);

      const refinedIntroduction =
        await this.pitchPerfectAgent.refineIntroduction(
          request.currentIntroduction,
          request.feedback,
          req.user.id
        );

      this.logger.log(`Successfully refined pitch for user ${req.user.id}`);

      return { refinedIntroduction };
    } catch (error) {
      this.logger.error(
        `Failed to refine pitch: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to refine pitch',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
