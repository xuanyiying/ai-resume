/**
 * AI Engine - Refactored Version
 * Now uses AIEngineService for multi-provider support
 * This class serves as a facade providing backward compatibility
 * and file extraction utilities
 */

import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { AIEngineService } from '../ai-providers/ai-engine.service';
import { AIRequest } from '../ai-providers/interfaces';
import {
  ParsedResumeData,
  ParsedJobDescription,
  OptimizationSuggestion,
  InterviewQuestion,
} from '@/types';

@Injectable()
export class AIEngine {
  private readonly logger = new Logger(AIEngine.name);

  constructor(private aiEngineService: AIEngineService) {}

  /**
   * Extract text content from a file buffer based on file type
   */
  async extractTextFromFile(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<string> {
    try {
      switch (fileType.toLowerCase()) {
        case 'pdf':
          return await this.extractTextFromPDF(fileBuffer);
        case 'docx':
          return await this.extractTextFromDOCX(fileBuffer);
        case 'txt':
          return fileBuffer.toString('utf-8');
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      this.logger.error(`Error extracting text from ${fileType} file:`, error);
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   */
  private async extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(fileBuffer);
      return data.text;
    } catch (error) {
      this.logger.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Extract text from DOCX file
   */
  private async extractTextFromDOCX(fileBuffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } catch (error) {
      this.logger.error('Error parsing DOCX:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Parse resume content using AI
   * Delegates to AIEngineService with multi-provider support
   */
  async parseResumeContent(content: string): Promise<ParsedResumeData> {
    try {
      this.logger.debug('Parsing resume content using AI engine service');

      const request: AIRequest = {
        model: '', // Will be auto-selected based on scenario
        prompt: content,
        metadata: {
          templateName: 'parse_resume',
          templateVariables: {
            resume_content: content,
          },
        },
      };

      const response = await this.aiEngineService.call(
        request,
        'system',
        'resume-parsing'
      );

      const parsedData: ParsedResumeData = JSON.parse(response.content);
      this.logger.debug('Resume parsing completed successfully');

      return parsedData;
    } catch (error) {
      this.logger.error('Failed to parse resume content:', error);
      // Return a basic structure on error
      return this.createEmptyResumeData();
    }
  }

  /**
   * Parse job description using AI
   * Delegates to AIEngineService with multi-provider support
   */
  async parseJobDescription(
    description: string
  ): Promise<ParsedJobDescription> {
    try {
      this.logger.debug('Parsing job description using AI engine service');

      const request: AIRequest = {
        model: '', // Will be auto-selected based on scenario
        prompt: description,
        metadata: {
          templateName: 'parse_job_description',
          templateVariables: {
            job_description: description,
          },
        },
      };

      const response = await this.aiEngineService.call(
        request,
        'system',
        'job-description-parsing'
      );

      const parsedData: ParsedJobDescription = JSON.parse(response.content);
      this.logger.debug('Job description parsing completed successfully');

      return parsedData;
    } catch (error) {
      this.logger.error('Failed to parse job description:', error);
      // Return a basic structure on error
      return {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        keywords: [],
      };
    }
  }

  /**
   * Generate optimization suggestions using AI
   * Delegates to AIEngineService with multi-provider support
   */
  async generateOptimizationSuggestions(
    resumeData: ParsedResumeData,
    jobDescription: string
  ): Promise<OptimizationSuggestion[]> {
    try {
      this.logger.debug(
        'Generating optimization suggestions using AI engine service'
      );

      const request: AIRequest = {
        model: '', // Will be auto-selected based on scenario
        prompt: '', // Will be filled by template
        metadata: {
          templateName: 'generate_suggestions',
          templateVariables: {
            resume_data: JSON.stringify(resumeData, null, 2),
            job_description: jobDescription,
          },
        },
      };

      const response = await this.aiEngineService.call(
        request,
        'system',
        'resume-optimization'
      );

      const suggestions: OptimizationSuggestion[] = JSON.parse(
        response.content
      );
      this.logger.debug(
        `Generated ${suggestions.length} optimization suggestions`
      );

      return suggestions;
    } catch (error) {
      this.logger.error('Failed to generate optimization suggestions:', error);
      return [];
    }
  }

  /**
   * Generate interview questions using AI
   * Delegates to AIEngineService with multi-provider support
   */
  async generateInterviewQuestions(
    resumeData: ParsedResumeData,
    jobDescription: string
  ): Promise<InterviewQuestion[]> {
    try {
      this.logger.debug(
        'Generating interview questions using AI engine service'
      );

      const request: AIRequest = {
        model: '', // Will be auto-selected based on scenario
        prompt: '', // Will be filled by template
        metadata: {
          templateName: 'generate_interview_questions',
          templateVariables: {
            resume_data: JSON.stringify(resumeData, null, 2),
            job_description: jobDescription,
          },
        },
      };

      const response = await this.aiEngineService.call(
        request,
        'system',
        'interview-question-generation'
      );

      const questions: InterviewQuestion[] = JSON.parse(response.content);
      this.logger.debug(`Generated ${questions.length} interview questions`);

      return questions;
    } catch (error) {
      this.logger.error('Failed to generate interview questions:', error);
      return [];
    }
  }

  /**
   * Create empty resume data structure
   * Used as fallback when parsing fails
   */
  private createEmptyResumeData(): ParsedResumeData {
    return {
      personalInfo: {
        name: '',
        email: '',
      },
      education: [],
      experience: [],
      skills: [],
      projects: [],
    };
  }

  /**
   * Chat with interviewer persona
   * Delegates to AIEngineService with multi-provider support
   */
  async chatWithInterviewer(
    context: string,
    message: string,
    history: { role: string; content: string }[]
  ): Promise<{ content: string; audioUrl?: string }> {
    try {
      this.logger.debug(
        'Generating interviewer response using AI engine service'
      );

      const request: AIRequest = {
        model: '', // Will be auto-selected based on scenario
        prompt: message,
        messages: [
          {
            role: 'system',
            content: context,
          },
          ...history.map((h) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
          })),
          {
            role: 'user',
            content: message,
          },
        ],
        metadata: {
          templateName: 'interviewer_chat',
          templateVariables: {
            context,
            message,
          },
        },
      };

      const response = await this.aiEngineService.call(
        request,
        'chat',
        'interview-chat'
      );

      return {
        content: response.content,
      };
    } catch (error) {
      this.logger.error('Failed to generate interviewer response:', error);
      throw error;
    }
  }

  /**
   * Generic generation method
   */
  async generate(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      const request: AIRequest = {
        model: '',
        prompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        metadata: {
          templateName: 'generic_generate',
        },
      };

      const response = await this.aiEngineService.call(
        request,
        'chat',
        'generic-generation'
      );

      return response.content;
    } catch (error) {
      this.logger.error('Failed to generate content:', error);
      throw error;
    }
  }

  /**
   * Clear cache (delegated to AIEngineService)
   */
  async clearCache(_cacheKey: string): Promise<void> {
    this.logger.debug('Cache management is now handled by AIEngineService');
    // Cache is managed by AIEngineService via Redis
  }

  /**
   * Clear all AI engine cache (delegated to AIEngineService)
   */
  async clearAllCache(): Promise<void> {
    this.logger.log('Cache management is now handled by AIEngineService');
    // Cache is managed by AIEngineService via Redis
  }
}
