import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { UsageTrackerService } from '../../ai-providers/tracking/usage-tracker.service';
import { PerformanceMonitorService } from '../../ai-providers/monitoring/performance-monitor.service';
import { RedisService } from '../../redis/redis.service';
import {
  WorkflowStep,
  WorkflowContext,
  WorkflowResult,
} from './workflow.interfaces';

/**
 * Workflow Orchestrator
 * Manages complex Agent workflows with sequential, parallel, and conditional execution
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
@Injectable()
export class WorkflowOrchestrator {
  private readonly logger = new Logger(WorkflowOrchestrator.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private aiEngineService: AIEngineService,
    private usageTracker: UsageTrackerService,
    private performanceMonitor: PerformanceMonitorService,
    private redisService: RedisService
  ) {}

  /**
   * Execute workflow steps sequentially
   * Property 31: Workflow Step Logging
   * Validates: Requirements 8.1, 8.3, 7.6
   */
  async executeSequential(
    steps: WorkflowStep[],
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const results: Record<string, unknown>[] = [];
    const tokenUsageByStep: Record<string, number> = {};
    let totalTokens = 0;

    for (const step of steps) {
      try {
        this.logger.debug(
          `Executing step: ${step.id} (${step.name}) in sequential mode`
        );

        const stepStartTime = Date.now();

        // Check cache for intermediate results
        const cachedResult = await this.getIntermediateResult(
          context.sessionId,
          step.id
        );
        if (cachedResult) {
          this.logger.debug(`Cache hit for step: ${step.id}`);
          results.push(cachedResult);
          tokenUsageByStep[step.id] = 0; // No tokens used for cached result
          continue;
        }

        // Execute the step
        const stepResult = await this.executeStep(step, context, results);
        results.push(stepResult);

        // Record step metrics
        const stepDuration = Date.now() - stepStartTime;
        const stepTokens =
          (stepResult as Record<string, unknown>).tokenUsage || 0;
        tokenUsageByStep[step.id] = stepTokens as number;
        totalTokens += stepTokens as number;

        // Update step with execution metrics
        step.latency = stepDuration;
        step.tokenUsage = stepTokens as number;
        step.output = stepResult;

        // Cache intermediate result
        await this.cacheIntermediateResult(
          context.sessionId,
          step.id,
          stepResult
        );

        // Log step execution
        this.logStepExecution(
          step,
          stepDuration,
          stepTokens as number,
          'success'
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Step ${step.id} failed: ${errorMessage}`);

        // Handle step error with fallback
        const fallbackResult = await this.handleStepError(step, error);
        results.push(fallbackResult);

        step.error = errorMessage;
        step.output = fallbackResult;

        // Log step execution failure
        this.logStepExecution(step, 0, 0, 'failed', errorMessage);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: results.length === steps.length && !steps.some((s) => s.error),
      results,
      tokenUsage: {
        total: totalTokens,
        byStep: tokenUsageByStep,
      },
      duration,
    };
  }

  /**
   * Execute workflow steps in parallel
   * Property 31: Workflow Step Logging
   * Validates: Requirements 8.1
   */
  async executeParallel(
    steps: WorkflowStep[],
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const tokenUsageByStep: Record<string, number> = {};

    this.logger.debug(`Executing ${steps.length} steps in parallel mode`);

    // Execute all steps concurrently
    const promises = steps.map((step) =>
      this.executeStep(step, context, []).catch((error) =>
        this.handleStepError(step, error)
      )
    );

    const settledResults = await Promise.allSettled(promises);

    const results: (Record<string, unknown> | null)[] = [];
    let totalTokens = 0;

    for (let i = 0; i < settledResults.length; i++) {
      const settled = settledResults[i];
      const step = steps[i];

      if (settled.status === 'fulfilled') {
        results.push(settled.value);
        const stepTokens =
          (settled.value as Record<string, unknown>).tokenUsage || 0;
        tokenUsageByStep[step.id] = stepTokens as number;
        totalTokens += stepTokens as number;

        step.output = settled.value;
        step.tokenUsage = stepTokens as number;

        this.logStepExecution(step, 0, stepTokens as number, 'success');
      } else {
        const errorMessage =
          settled.reason instanceof Error
            ? settled.reason.message
            : String(settled.reason);
        results.push(null);
        step.error = errorMessage;

        this.logStepExecution(step, 0, 0, 'failed', errorMessage);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: settledResults.every((r) => r.status === 'fulfilled'),
      results,
      tokenUsage: {
        total: totalTokens,
        byStep: tokenUsageByStep,
      },
      duration,
    };
  }

  /**
   * Execute workflow with conditional branching
   * Property 31: Workflow Step Logging
   * Validates: Requirements 8.1, 8.2
   */
  async executeConditional(
    condition: (context: WorkflowContext) => boolean,
    trueBranch: WorkflowStep[],
    falseBranch: WorkflowStep[],
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    this.logger.debug('Executing conditional workflow');

    const shouldExecuteTrueBranch = condition(context);
    const selectedBranch = shouldExecuteTrueBranch ? trueBranch : falseBranch;

    this.logger.debug(
      `Condition evaluated to ${shouldExecuteTrueBranch}, executing ${selectedBranch.length} steps`
    );

    return this.executeSequential(selectedBranch, context);
  }

  /**
   * Execute a single workflow step
   * Property 31: Workflow Step Logging
   * Validates: Requirements 8.4
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    previousResults: Record<string, unknown>[]
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case 'llm-call':
        return this.executeLLMCall(step, context);
      case 'tool-use':
        return this.executeToolUse(step, context, previousResults);
      case 'rag-retrieval':
        return this.executeRAGRetrieval(step, context);
      case 'compression':
        return this.executeCompression(step, context, previousResults);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute LLM call step
   * Validates: Requirements 8.1
   */
  private async executeLLMCall(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, unknown>> {
    const { prompt, temperature, maxTokens } = step.input as Record<
      string,
      unknown
    >;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt: prompt as string,
        temperature: (temperature as number) || 0.7,
        maxTokens: (maxTokens as number) || 1000,
      },
      context.userId,
      this.mapModelTierToScenario(step.modelTier)
    );

    return {
      content: response.content,
      tokenUsage: response.usage.totalTokens || 0,
    };
  }

  /**
   * Execute tool use step
   * Validates: Requirements 8.1
   */
  private async executeToolUse(
    step: WorkflowStep,
    _context: WorkflowContext,
    _previousResults: Record<string, unknown>[]
  ): Promise<Record<string, unknown>> {
    const { toolName, toolInput } = step.input;

    // This is a placeholder for tool execution
    // In a real implementation, this would dispatch to the appropriate tool
    this.logger.debug(`Executing tool: ${toolName} with input:`, toolInput);

    return {
      result: `Tool ${toolName} executed`,
      tokenUsage: 0,
    };
  }

  /**
   * Execute RAG retrieval step
   * Validates: Requirements 8.1
   */
  private async executeRAGRetrieval(
    step: WorkflowStep,
    _context: WorkflowContext
  ): Promise<Record<string, unknown>> {
    const { query } = step.input;

    // This is a placeholder for RAG retrieval
    // In a real implementation, this would call RAGService
    this.logger.debug(`Executing RAG retrieval for query: ${query}`);

    return {
      documents: [],
      tokenUsage: 0,
    };
  }

  /**
   * Execute compression step
   * Validates: Requirements 8.1
   */
  private async executeCompression(
    step: WorkflowStep,
    _context: WorkflowContext,
    _previousResults: Record<string, unknown>[]
  ): Promise<Record<string, unknown>> {
    const { content, maxTokens } = step.input;

    // This is a placeholder for compression
    // In a real implementation, this would call ContextCompressorService
    this.logger.debug(`Compressing content to ${maxTokens} tokens`);

    return {
      compressed: content,
      tokenUsage: 0,
    };
  }

  /**
   * Handle step errors with fallback strategies
   * Property 30: Workflow Error Resilience
   * Validates: Requirements 8.3
   */
  private async handleStepError(
    step: WorkflowStep,
    error: unknown
  ): Promise<Record<string, unknown>> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Handling error for step ${step.id}: ${errorMessage}`);
    switch (step.type) {
      case 'llm-call':
        return { content: '', tokenUsage: 0, error: errorMessage };
      case 'tool-use':
        return { result: null, tokenUsage: 0, error: errorMessage };
      case 'rag-retrieval':
        return { documents: [], tokenUsage: 0, error: errorMessage };
      case 'compression':
        return { compressed: '', tokenUsage: 0, error: errorMessage };
      default:
        return { error: errorMessage };
    }
  }

  /**
   * Cache intermediate workflow results
   * Property 29: Intermediate Result Caching
   * Validates: Requirements 7.6
   */
  private async cacheIntermediateResult(
    sessionId: string,
    stepId: string,
    result: Record<string, unknown>
  ): Promise<void> {
    const cacheKey = `workflow:${sessionId}:step:${stepId}`;
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.CACHE_TTL
      );
      this.logger.debug(`Cached intermediate result for step: ${stepId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to cache intermediate result for step ${stepId}:`,
        error
      );
    }
  }

  /**
   * Retrieve cached intermediate result
   * Property 29: Intermediate Result Caching
   * Validates: Requirements 7.6
   */
  private async getIntermediateResult(
    sessionId: string,
    stepId: string
  ): Promise<Record<string, unknown> | null> {
    const cacheKey = `workflow:${sessionId}:step:${stepId}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Record<string, unknown>;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve cached result for step ${stepId}:`,
        error
      );
    }
    return null;
  }

  /**
   * Log workflow step execution
   * Property 31: Workflow Step Logging
   * Validates: Requirements 8.4
   */
  private logStepExecution(
    step: WorkflowStep,
    duration: number,
    tokenUsage: number,
    status: 'success' | 'failed',
    error?: string
  ): void {
    const logData = {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      modelTier: step.modelTier,
      duration,
      tokenUsage,
      status,
      error,
    };

    if (status === 'success') {
      this.logger.debug(`Step execution completed: ${JSON.stringify(logData)}`);
    } else {
      this.logger.error(`Step execution failed: ${JSON.stringify(logData)}`);
    }
  }

  /**
   * Map model tier to scenario type for AIEngineService
   * Validates: Requirements 5.1
   */
  private mapModelTierToScenario(
    modelTier: 'cost-optimized' | 'balanced' | 'quality-optimized'
  ): string {
    switch (modelTier) {
      case 'cost-optimized':
        return 'cost-optimized';
      case 'balanced':
        return 'balanced';
      case 'quality-optimized':
        return 'quality-optimized';
      default:
        return 'balanced';
    }
  }
}
