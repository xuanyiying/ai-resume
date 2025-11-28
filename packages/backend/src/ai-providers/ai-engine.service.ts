/**
 * AI Engine Service
 * Integrates all AI provider components into a unified service
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIRequest, AIResponse, AIStreamChunk, ModelInfo } from './interfaces';
import { AIProviderFactory } from './factory';
import { ModelSelector, ScenarioType } from './selector/model.selector';
import { PromptTemplateManager } from './config/prompt-template.manager';
import { UsageTrackerService } from './tracking/usage-tracker.service';
import { PerformanceMonitorService } from './monitoring/performance-monitor.service';
import { RetryHandler } from './utils/retry-handler';
import { AIError, AIErrorCode } from './utils/ai-error';
import { AILogger } from './logging/ai-logger';

/**
 * AI Engine Service
 * Unified interface for calling AI providers with integrated features:
 * - Model selection based on scenario
 * - Prompt template management
 * - Error handling and retry logic
 * - Cost and usage tracking
 * - Performance monitoring
 * - Logging and auditing
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6
 */
@Injectable()
export class AIEngineService implements OnModuleInit {
  private readonly logger = new Logger(AIEngineService.name);
  private modelSelector: ModelSelector;
  private retryHandler: RetryHandler;
  private availableModels: Map<string, ModelInfo> = new Map();

  constructor(
    private providerFactory: AIProviderFactory,
    private promptTemplateManager: PromptTemplateManager,
    private usageTracker: UsageTrackerService,
    private performanceMonitor: PerformanceMonitorService,
    private aiLogger: AILogger
  ) {
    this.modelSelector = new ModelSelector();
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    });
  }

  /**
   * Initialize on module startup
   * Load all available models from providers
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing AI Engine Service');

    try {
      await this.loadAvailableModels();
      this.logger.log(
        `AI Engine Service initialized with ${this.availableModels.size} models`
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize AI Engine Service: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Load all available models from all providers
   * Property 2: Provider initialization
   * Validates: Requirements 1.6
   */
  private async loadAvailableModels(): Promise<void> {
    this.availableModels.clear();

    const providers = this.providerFactory.getAvailableProviders();

    for (const provider of providers) {
      try {
        const modelNames = await provider.listModels();

        for (const modelName of modelNames) {
          try {
            const modelInfo = await provider.getModelInfo(modelName);
            const key = `${provider.name}:${modelName}`;
            this.availableModels.set(key, modelInfo);

            this.logger.debug(
              `Loaded model: ${key} (cost: ${modelInfo.costPerInputToken}/${modelInfo.costPerOutputToken})`
            );
          } catch (error) {
            this.logger.warn(
              `Failed to get info for model ${modelName} from provider ${provider.name}:`,
              error
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to list models from provider ${provider.name}:`,
          error
        );
      }
    }

    this.logger.log(`Loaded ${this.availableModels.size} total models`);
  }

  /**
   * Call AI with unified interface
   * Property 5: Unified request format
   * Property 6: Unified response format
   * Validates: Requirements 2.3, 2.4
   *
   * @param request - Unified AI request
   * @param userId - User ID for tracking
   * @param scenario - Scenario name for model selection
   * @returns Unified AI response
   */
  async call(
    request: AIRequest,
    userId: string,
    scenario: string = ScenarioType.GENERAL,
    language: string = 'en'
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let selectedModel = '';
    let providerName = '';

    try {
      // Validate request
      this.validateRequest(request);

      // Select model if not specified
      selectedModel = request.model;
      if (!selectedModel) {
        selectedModel = this.selectBestModel(scenario);
      }

      // Get provider and model info
      const [provider, modelName] = selectedModel.split(':');
      providerName = provider;
      const providerInstance = this.providerFactory.getProvider(providerName);
      const modelInfo = this.availableModels.get(selectedModel);

      if (!modelInfo) {
        throw new AIError(
          AIErrorCode.INVALID_REQUEST,
          `Model ${selectedModel} not found`,
          undefined,
          false
        );
      }

      // Render prompt template if needed
      let finalPrompt = request.prompt;
      if (request.metadata?.templateName) {
        const template = await this.promptTemplateManager.getTemplate(
          request.metadata.templateName as string,
          language,
          providerName
        );

        if (template) {
          finalPrompt = await this.promptTemplateManager.renderTemplate(
            template,
            request.metadata.templateVariables as Record<string, string>
          );
        }
      }

      // Prepare request for provider
      const providerRequest: AIRequest = {
        ...request,
        model: modelName,
        prompt: finalPrompt,
      };

      // Execute with retry
      let response: AIResponse;
      try {
        response = await this.retryHandler.executeWithRetry(async () => {
          return await providerInstance.call(providerRequest);
        });
      } catch (error) {
        // Log error
        await this.aiLogger.logError(
          selectedModel,
          providerName,
          error instanceof AIError ? error.code : AIErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
          scenario,
          userId
        );

        throw error;
      }

      // Record latency
      const latency = Date.now() - startTime;

      // Calculate cost
      const cost =
        response.usage.inputTokens * modelInfo.costPerInputToken +
        response.usage.outputTokens * modelInfo.costPerOutputToken;

      // Track usage
      await this.usageTracker.recordUsage({
        userId,
        model: selectedModel,
        provider: providerName,
        scenario,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cost,
        latency,
        success: true,
      });

      // Record performance metrics
      await this.performanceMonitor.recordMetrics(
        selectedModel,
        providerName,
        latency,
        true
      );

      // Log successful response
      await this.aiLogger.logAICall({
        model: selectedModel,
        provider: providerName,
        scenario,
        responseContent: response.content.substring(0, 500), // Truncate for logging
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latency,
        success: true,
        userId,
      });

      this.logger.debug(
        `AI call completed: model=${selectedModel}, latency=${latency}ms, cost=${cost}`
      );

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Record failed call
      await this.performanceMonitor.recordMetrics(
        selectedModel || request.model || 'unknown',
        providerName || 'unknown',
        latency,
        false
      );

      this.logger.error(
        `AI call failed: ${error instanceof Error ? error.message : String(error)}`
      );

      throw error;
    }
  }

  /**
   * Stream AI response
   * Property 7: Stream and non-stream support
   * Validates: Requirements 2.5
   *
   * @param request - Unified AI request
   * @param userId - User ID for tracking
   * @param scenario - Scenario name for model selection
   * @returns Async iterable of stream chunks
   */
  async *stream(
    request: AIRequest,
    userId: string,
    scenario: string = ScenarioType.GENERAL,
    language: string = 'en'
  ): AsyncGenerator<AIStreamChunk> {
    const startTime = Date.now();
    let selectedModel = '';
    let providerName = '';

    try {
      // Validate request
      this.validateRequest(request);

      // Select model if not specified
      selectedModel = request.model;
      if (!selectedModel) {
        selectedModel = this.selectBestModel(scenario);
      }

      // Get provider and model info
      const [provider, modelName] = selectedModel.split(':');
      providerName = provider;
      const providerInstance = this.providerFactory.getProvider(providerName);

      // Render prompt template if needed
      let finalPrompt = request.prompt;
      if (request.metadata?.templateName) {
        const template = await this.promptTemplateManager.getTemplate(
          request.metadata.templateName as string,
          language,
          providerName
        );

        if (template) {
          finalPrompt = await this.promptTemplateManager.renderTemplate(
            template,
            request.metadata.templateVariables as Record<string, string>
          );
        }
      }

      // Prepare request for provider
      const providerRequest: AIRequest = {
        ...request,
        model: modelName,
        prompt: finalPrompt,
      };

      // Stream with retry
      try {
        for await (const chunk of providerInstance.stream(providerRequest)) {
          yield chunk;
        }
      } catch (error) {
        // Log error
        await this.aiLogger.logError(
          selectedModel,
          providerName,
          error instanceof AIError ? error.code : AIErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
          scenario,
          userId
        );

        throw error;
      }

      // Record latency
      const latency = Date.now() - startTime;

      // Record performance metrics
      await this.performanceMonitor.recordMetrics(
        selectedModel,
        providerName,
        latency,
        true
      );

      // Log successful stream
      await this.aiLogger.logAICall({
        model: selectedModel,
        provider: providerName,
        scenario,
        latency,
        success: true,
        userId,
      });

      this.logger.debug(
        `AI stream completed: model=${selectedModel}, latency=${latency}ms`
      );
    } catch (error) {
      const latency = Date.now() - startTime;

      // Record failed call
      await this.performanceMonitor.recordMetrics(
        selectedModel || request.model || 'unknown',
        providerName || 'unknown',
        latency,
        false
      );

      this.logger.error(
        `AI stream failed: ${error instanceof Error ? error.message : String(error)}`
      );

      throw error;
    }
  }

  /**
   * Select the best model for a scenario
   * Property 22: Scenario selection strategy definition
   * Property 23: Resume parsing cost optimization
   * Property 24: Optimization suggestion quality optimization
   * Property 25: Interview question speed optimization
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   *
   * @param scenario - Scenario name
   * @returns Selected model name
   */
  private selectBestModel(scenario: string): string {
    const availableModels = Array.from(this.availableModels.values());

    if (availableModels.length === 0) {
      throw new AIError(
        AIErrorCode.PROVIDER_UNAVAILABLE,
        'No models available',
        undefined,
        true
      );
    }

    const selectedModel = this.modelSelector.selectModel(
      availableModels,
      scenario
    );

    return `${selectedModel.provider}:${selectedModel.name}`;
  }

  /**
   * Get all available models
   * Property 1: Multiple provider support
   * Validates: Requirements 1.1-1.5
   *
   * @returns Array of available models
   */
  getAvailableModels(): ModelInfo[] {
    return Array.from(this.availableModels.values());
  }

  /**
   * Get available models for a specific provider
   *
   * @param providerName - Provider name
   * @returns Array of models from that provider
   */
  getModelsByProvider(providerName: string): ModelInfo[] {
    return Array.from(this.availableModels.values()).filter(
      (m) => m.provider === providerName
    );
  }

  /**
   * Get model info by name
   *
   * @param modelName - Model name (format: provider:model)
   * @returns Model info or undefined
   */
  getModelInfo(modelName: string): ModelInfo | undefined {
    return this.availableModels.get(modelName);
  }

  /**
   * Reload models from providers
   * Property 3: Dynamic configuration update
   * Validates: Requirements 1.7
   */
  async reloadModels(): Promise<void> {
    this.logger.log('Reloading available models');

    try {
      await this.loadAvailableModels();
      this.logger.log('Models reloaded successfully');
    } catch (error) {
      this.logger.error(
        `Failed to reload models: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get model selection statistics
   * Property 28: Model selection logging
   * Validates: Requirements 5.7
   *
   * @returns Selection statistics
   */
  getSelectionStatistics() {
    return this.modelSelector.getSelectionStatistics();
  }

  /**
   * Get selection decision log
   *
   * @param limit - Maximum number of recent decisions
   * @returns Array of selection decisions
   */
  getSelectionLog(limit?: number) {
    return this.modelSelector.getSelectionLog(limit);
  }

  /**
   * Validate AI request
   * Property 5: Unified request format
   * Validates: Requirements 2.3
   */
  private validateRequest(request: AIRequest): void {
    if (!request.prompt || !request.prompt.trim()) {
      throw new AIError(
        AIErrorCode.INVALID_REQUEST,
        'Prompt is required',
        undefined,
        false
      );
    }

    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 2) {
        throw new AIError(
          AIErrorCode.INVALID_REQUEST,
          'Temperature must be between 0 and 2',
          undefined,
          false
        );
      }
    }

    if (request.maxTokens !== undefined) {
      if (request.maxTokens < 1) {
        throw new AIError(
          AIErrorCode.INVALID_REQUEST,
          'Max tokens must be at least 1',
          undefined,
          false
        );
      }
    }

    if (request.topP !== undefined) {
      if (request.topP < 0 || request.topP > 1) {
        throw new AIError(
          AIErrorCode.INVALID_REQUEST,
          'Top P must be between 0 and 1',
          undefined,
          false
        );
      }
    }

    if (request.topK !== undefined) {
      if (request.topK < 1) {
        throw new AIError(
          AIErrorCode.INVALID_REQUEST,
          'Top K must be at least 1',
          undefined,
          false
        );
      }
    }
  }

  /**
   * Get cost and usage statistics
   * Property 36: Cost aggregation
   * Validates: Requirements 7.2
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @param groupBy - Group by model, scenario, or user
   * @returns Cost report
   */
  async getCostReport(
    startDate: Date,
    endDate: Date,
    groupBy: 'model' | 'scenario' | 'user' = 'model'
  ) {
    return await this.usageTracker.generateCostReport(
      startDate,
      endDate,
      groupBy
    );
  }

  /**
   * Get performance metrics
   * Property 42: Performance metrics calculation
   * Validates: Requirements 8.2
   *
   * @param model - Model name
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Performance metrics
   */
  async getPerformanceMetrics(model: string, startDate?: Date, endDate?: Date) {
    return await this.performanceMonitor.getMetrics(model, startDate, endDate);
  }

  /**
   * Check for performance alerts
   * Property 44: Failure rate alert
   * Property 45: Response time alert
   * Validates: Requirements 8.4, 8.5
   *
   * @returns Array of alerts
   */
  async checkPerformanceAlerts() {
    return await this.performanceMonitor.checkAlerts();
  }

  /**
   * Get AI logs
   * Property 62: Log query
   * Validates: Requirements 11.5
   *
   * @param filters - Log filters
   * @returns Array of logs
   */
  async getLogs(filters: {
    model?: string;
    provider?: string;
    scenario?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    return await this.aiLogger.queryLogs({
      model: filters.model,
      provider: filters.provider,
      scenario: filters.scenario,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
    });
  }
}
