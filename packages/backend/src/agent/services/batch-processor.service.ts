/**
 * Batch Processor Service
 * Handles batch processing of common questions and other content
 * Schedules processing during off-peak hours and stores results in vector database
 * Requirements: 7.3, 7.4
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { VectorDbService } from './vector-db.service';
import { RAGService, InterviewQuestion } from './rag.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface BatchJob {
  id: string;
  type: 'generate-questions' | 'generate-answers' | 'generate-examples';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  itemsProcessed: number;
  totalItems: number;
}

export interface BatchGenerationConfig {
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
  maxConcurrentBatches: number;
}

@Injectable()
export class BatchProcessorService implements OnModuleInit {
  private readonly logger = new Logger(BatchProcessorService.name);
  private readonly DEFAULT_BATCH_SIZE = 10;
  private readonly DEFAULT_DELAY = 1000; // 1 second between batches
  private readonly DEFAULT_MAX_CONCURRENT = 3;
  private activeBatches: Map<string, BatchJob> = new Map();
  private config: BatchGenerationConfig = {
    batchSize: this.DEFAULT_BATCH_SIZE,
    delayBetweenBatches: this.DEFAULT_DELAY,
    maxConcurrentBatches: this.DEFAULT_MAX_CONCURRENT,
  };

  constructor(
    private aiEngineService: AIEngineService,
    private vectorDbService: VectorDbService,
    private ragService: RAGService,
    private prisma: PrismaService
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Batch Processor Service initialized');
  }

  /**
   * Batch generate common interview questions
   * Scheduled to run during off-peak hours (2 AM UTC)
   * Property 7.3, 7.4
   * Validates: Requirements 7.3, 7.4
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async batchGenerateCommonQuestions(): Promise<void> {
    try {
      this.logger.log(
        'Starting batch generation of common interview questions'
      );

      const jobId = this.generateJobId();
      const job: BatchJob = {
        id: jobId,
        type: 'generate-questions',
        status: 'processing',
        input: {},
        itemsProcessed: 0,
        totalItems: 0,
        createdAt: new Date(),
        startedAt: new Date(),
      };

      this.activeBatches.set(jobId, job);

      try {
        // Define question generation templates
        const templates = [
          {
            role: 'Software Engineer',
            keywords: ['algorithms', 'data structures', 'system design'],
            levels: ['junior', 'mid', 'senior'],
          },
          {
            role: 'Product Manager',
            keywords: ['product strategy', 'metrics', 'user research'],
            levels: ['junior', 'mid', 'senior'],
          },
          {
            role: 'Data Scientist',
            keywords: ['machine learning', 'statistics', 'data analysis'],
            levels: ['junior', 'mid', 'senior'],
          },
          {
            role: 'DevOps Engineer',
            keywords: ['kubernetes', 'CI/CD', 'infrastructure'],
            levels: ['junior', 'mid', 'senior'],
          },
        ];

        let totalGenerated = 0;

        // Generate questions for each template
        for (const template of templates) {
          for (const level of template.levels) {
            const questions = await this.generateQuestionsForRole(
              template.role,
              template.keywords,
              level
            );

            // Store in vector database
            const documents = questions.map((q) => ({
              content: JSON.stringify(q),
              metadata: {
                role: template.role,
                level,
                type: q.type,
                difficulty: q.difficulty,
              },
            }));

            await this.vectorDbService.addDocuments(documents);

            totalGenerated += questions.length;
            job.itemsProcessed += questions.length;

            this.logger.debug(
              `Generated ${questions.length} questions for ${template.role} (${level})`
            );

            // Add delay between batches to avoid rate limiting
            await this.delay(this.config.delayBetweenBatches);
          }
        }

        job.status = 'completed';
        job.completedAt = new Date();
        job.output = {
          totalGenerated,
          timestamp: new Date().toISOString(),
        };

        this.logger.log(
          `Batch generation completed: ${totalGenerated} questions generated`
        );
      } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = new Date();

        this.logger.error(`Batch generation failed: ${job.error}`);
      } finally {
        this.activeBatches.set(jobId, job);
      }
    } catch (error) {
      this.logger.error(
        `Failed to run batch generation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate questions for a specific role and level
   */
  private async generateQuestionsForRole(
    role: string,
    keywords: string[],
    level: string
  ): Promise<InterviewQuestion[]> {
    try {
      const prompt = `Generate 5 interview questions for a ${level}-level ${role} position.
Focus on these areas: ${keywords.join(', ')}.

For each question, provide:
1. The question itself
2. A suggested answer (2-3 sentences)
3. Difficulty level (easy, medium, hard)
4. Question type (technical, behavioral, scenario)

Format as JSON array with objects containing: question, suggestedAnswer, difficulty, type`;

      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt,
          maxTokens: 2000,
        },
        'system',
        'batch-question-generation'
      );

      // Parse response as JSON
      let jsonStr = response.content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const questions = JSON.parse(jsonStr) as InterviewQuestion[];

      return questions.map((q) => ({
        ...q,
        difficulty: (q.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        type: (q.type || 'technical') as
          | 'technical'
          | 'behavioral'
          | 'scenario',
      }));
    } catch (error) {
      this.logger.error(
        `Failed to generate questions for ${role}: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Batch generate STAR examples
   * Scheduled to run during off-peak hours (3 AM UTC)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async batchGenerateSTARExamples(): Promise<void> {
    try {
      this.logger.log('Starting batch generation of STAR examples');

      const jobId = this.generateJobId();
      const job: BatchJob = {
        id: jobId,
        type: 'generate-examples',
        status: 'processing',
        input: {},
        itemsProcessed: 0,
        totalItems: 0,
        createdAt: new Date(),
        startedAt: new Date(),
      };

      this.activeBatches.set(jobId, job);

      try {
        const industries = [
          'Technology',
          'Finance',
          'Healthcare',
          'E-commerce',
          'Manufacturing',
        ];
        const scenarios = [
          'Handling a difficult project deadline',
          'Resolving team conflicts',
          'Implementing a new system',
          'Improving process efficiency',
          'Leading a cross-functional initiative',
        ];

        let totalGenerated = 0;

        for (const industry of industries) {
          for (const scenario of scenarios) {
            const examples = await this.generateSTARExamples(
              industry,
              scenario
            );

            // Store in vector database
            const documents = examples.map((ex) => ({
              content: JSON.stringify(ex),
              metadata: {
                industry,
                scenario,
                type: 'star-example',
              },
            }));

            await this.vectorDbService.addDocuments(documents);

            totalGenerated += examples.length;
            job.itemsProcessed += examples.length;

            this.logger.debug(
              `Generated ${examples.length} STAR examples for ${industry} - ${scenario}`
            );

            // Add delay between batches
            await this.delay(this.config.delayBetweenBatches);
          }
        }

        job.status = 'completed';
        job.completedAt = new Date();
        job.output = {
          totalGenerated,
          timestamp: new Date().toISOString(),
        };

        this.logger.log(
          `STAR examples batch generation completed: ${totalGenerated} examples generated`
        );
      } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = new Date();

        this.logger.error(
          `STAR examples batch generation failed: ${job.error}`
        );
      } finally {
        this.activeBatches.set(jobId, job);
      }
    } catch (error) {
      this.logger.error(
        `Failed to run STAR examples batch generation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate STAR examples for a scenario
   */
  private async generateSTARExamples(
    industry: string,
    scenario: string
  ): Promise<
    Array<{
      situation: string;
      task: string;
      action: string;
      result: string;
    }>
  > {
    try {
      const prompt = `Generate 3 STAR (Situation, Task, Action, Result) examples for a ${industry} professional facing this scenario: "${scenario}".

For each example, provide:
1. Situation: The context and challenge
2. Task: What needed to be done
3. Action: What you did
4. Result: The outcome and impact

Format as JSON array with objects containing: situation, task, action, result`;

      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt,
          maxTokens: 1500,
        },
        'system',
        'batch-star-generation'
      );

      // Parse response as JSON
      let jsonStr = response.content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const examples = JSON.parse(jsonStr) as Array<{
        situation: string;
        task: string;
        action: string;
        result: string;
      }> | null;

      if (!examples) {
        return [];
      }

      return examples;
    } catch (error) {
      this.logger.error(
        `Failed to generate STAR examples for ${industry}: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Get batch job status
   */
  async getBatchJobStatus(jobId: string): Promise<BatchJob | null> {
    const job = this.activeBatches.get(jobId);
    if (job) {
      return job;
    }

    // Try to fetch from database if not in active batches
    try {
      // This would require storing batch jobs in database
      // For now, return null if not found in active batches
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get batch job status: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Get all active batch jobs
   */
  getActiveBatchJobs(): BatchJob[] {
    return Array.from(this.activeBatches.values());
  }

  /**
   * Configure batch processing
   */
  configureBatchProcessing(config: Partial<BatchGenerationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    this.logger.log(
      `Batch processing configured: ${JSON.stringify(this.config)}`
    );
  }

  /**
   * Helper: Generate unique job ID
   */
  private generateJobId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
