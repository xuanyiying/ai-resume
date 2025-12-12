/**
 * Model Selector
 * Selects the best model for a given scenario based on configured strategies
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModelInfo } from '../interfaces';
import {
  ModelSelectionStrategy,
  SelectionContext,
  CostOptimizedStrategy,
  QualityOptimizedStrategy,
  LatencyOptimizedStrategy,
  BalancedStrategy,
} from './model-selection.strategy';

/**
 * Scenario types for model selection
 */
export enum ScenarioType {
  RESUME_PARSING = 'resume-parsing',
  JOB_DESCRIPTION_PARSING = 'job-description-parsing',
  RESUME_OPTIMIZATION = 'resume-optimization',
  INTERVIEW_QUESTION_GENERATION = 'interview-question-generation',
  MATCH_SCORE_CALCULATION = 'match-score-calculation',
  GENERAL = 'general',
  // Agent scenarios
  AGENT_STAR_EXTRACTION = 'agent-star-extraction',
  AGENT_KEYWORD_MATCHING = 'agent-keyword-matching',
  AGENT_INTRODUCTION_GENERATION = 'agent-introduction-generation',
  AGENT_CONTEXT_ANALYSIS = 'agent-context-analysis',
  AGENT_CUSTOM_QUESTION_GENERATION = 'agent-custom-question-generation',
  AGENT_QUESTION_PRIORITIZATION = 'agent-question-prioritization',
  AGENT_INTERVIEW_INITIALIZATION = 'agent-interview-initialization',
  AGENT_RESPONSE_PROCESSING = 'agent-response-processing',
  AGENT_RESPONSE_ANALYSIS = 'agent-response-analysis',
  AGENT_INTERVIEW_CONCLUSION = 'agent-interview-conclusion',
  AGENT_CONTEXT_COMPRESSION = 'agent-context-compression',
  AGENT_RAG_RETRIEVAL = 'agent-rag-retrieval',
}

/**
 * Model Selector Service
 * Manages model selection strategies and selects the best model for each scenario
 */
@Injectable()
export class ModelSelector {
  private readonly logger = new Logger(ModelSelector.name);
  private strategies: Map<string, ModelSelectionStrategy>;
  private selectionLog: SelectionDecision[] = [];

  constructor() {
    this.strategies = new Map();
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default strategies for each scenario
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  private initializeDefaultStrategies(): void {
    // Resume parsing: cost optimized (high volume, low complexity)
    this.strategies.set(
      ScenarioType.RESUME_PARSING,
      new CostOptimizedStrategy()
    );

    // Job description parsing: cost optimized (high volume, low complexity)
    this.strategies.set(
      ScenarioType.JOB_DESCRIPTION_PARSING,
      new CostOptimizedStrategy()
    );

    // Resume optimization: quality optimized (important output, user-facing)
    this.strategies.set(
      ScenarioType.RESUME_OPTIMIZATION,
      new QualityOptimizedStrategy()
    );

    // Interview question generation: latency optimized (real-time interaction)
    this.strategies.set(
      ScenarioType.INTERVIEW_QUESTION_GENERATION,
      new LatencyOptimizedStrategy()
    );

    // Match score calculation: balanced (important but not critical)
    this.strategies.set(
      ScenarioType.MATCH_SCORE_CALCULATION,
      new BalancedStrategy()
    );

    // General: balanced (default for unknown scenarios)
    this.strategies.set(ScenarioType.GENERAL, new BalancedStrategy());

    // Agent scenarios - Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
    // STAR extraction: cost optimized (information extraction, high volume)
    this.strategies.set(
      ScenarioType.AGENT_STAR_EXTRACTION,
      new CostOptimizedStrategy()
    );

    // Keyword matching: cost optimized (simple comparison, no LLM needed ideally)
    this.strategies.set(
      ScenarioType.AGENT_KEYWORD_MATCHING,
      new CostOptimizedStrategy()
    );

    // Introduction generation: quality optimized (user-facing, important output)
    this.strategies.set(
      ScenarioType.AGENT_INTRODUCTION_GENERATION,
      new QualityOptimizedStrategy()
    );

    // Context analysis: cost optimized (information extraction)
    this.strategies.set(
      ScenarioType.AGENT_CONTEXT_ANALYSIS,
      new CostOptimizedStrategy()
    );

    // Custom question generation: quality optimized (user-facing, important)
    this.strategies.set(
      ScenarioType.AGENT_CUSTOM_QUESTION_GENERATION,
      new QualityOptimizedStrategy()
    );

    // Question prioritization: balanced (important but not critical)
    this.strategies.set(
      ScenarioType.AGENT_QUESTION_PRIORITIZATION,
      new BalancedStrategy()
    );

    // Interview initialization: quality optimized (sets tone for interview)
    this.strategies.set(
      ScenarioType.AGENT_INTERVIEW_INITIALIZATION,
      new QualityOptimizedStrategy()
    );

    // Response processing: latency optimized (real-time interaction)
    this.strategies.set(
      ScenarioType.AGENT_RESPONSE_PROCESSING,
      new LatencyOptimizedStrategy()
    );

    // Response analysis: balanced (important but not critical)
    this.strategies.set(
      ScenarioType.AGENT_RESPONSE_ANALYSIS,
      new BalancedStrategy()
    );

    // Interview conclusion: quality optimized (important feedback)
    this.strategies.set(
      ScenarioType.AGENT_INTERVIEW_CONCLUSION,
      new QualityOptimizedStrategy()
    );

    // Context compression: cost optimized (token reduction, high volume)
    this.strategies.set(
      ScenarioType.AGENT_CONTEXT_COMPRESSION,
      new CostOptimizedStrategy()
    );

    // RAG retrieval: cost optimized (information retrieval, no generation)
    this.strategies.set(
      ScenarioType.AGENT_RAG_RETRIEVAL,
      new CostOptimizedStrategy()
    );

    this.logger.log('Default model selection strategies initialized');
  }

  /**
   * Select the best model for a given scenario
   * Requirements: 5.1, 5.5, 5.6
   *
   * @param availableModels - Array of available models
   * @param scenario - Scenario name
   * @param context - Optional selection context
   * @param agentContext - Optional Agent-specific context for logging
   * @returns The selected model
   * @throws Error if no strategy is defined for the scenario or no models are available
   */
  selectModel(
    availableModels: ModelInfo[],
    scenario: string,
    context?: Partial<SelectionContext>,
    agentContext?: AgentSelectionContext
  ): ModelInfo {
    // Filter available models
    const activeModels = availableModels.filter((m) => m.isAvailable);

    if (activeModels.length === 0) {
      this.logger.warn(
        `No available models for scenario: ${scenario}. Attempting fallback to all models.`
      );
      if (availableModels.length === 0) {
        throw new Error(
          `No models available for scenario: ${scenario}. Cannot select a model.`
        );
      }
      // Use first unavailable model as fallback (degraded mode)
      return availableModels[0];
    }

    // Get strategy for scenario
    const strategy = this.strategies.get(scenario);
    if (!strategy) {
      this.logger.warn(
        `No strategy defined for scenario: ${scenario}. Using general strategy.`
      );
      return this.strategies
        .get(ScenarioType.GENERAL)!
        .selectModel(activeModels, {
          scenario,
          ...context,
        });
    }

    // Select model using strategy
    const selectedModel = strategy.selectModel(activeModels, {
      scenario,
      ...context,
    });

    // Log selection decision with Agent context
    this.logSelectionDecision(
      scenario,
      selectedModel,
      activeModels.length,
      strategy.constructor.name,
      agentContext
    );

    return selectedModel;
  }

  /**
   * Register a custom strategy for a scenario
   * Requirements: 5.1
   *
   * @param scenario - Scenario name
   * @param strategy - Model selection strategy
   */
  registerStrategy(scenario: string, strategy: ModelSelectionStrategy): void {
    this.strategies.set(scenario, strategy);
    this.logger.log(
      `Registered strategy for scenario: ${scenario} (${strategy.constructor.name})`
    );
  }

  /**
   * Get the strategy for a scenario
   *
   * @param scenario - Scenario name
   * @returns The strategy or undefined if not found
   */
  getStrategy(scenario: string): ModelSelectionStrategy | undefined {
    return this.strategies.get(scenario);
  }

  /**
   * Get all registered scenarios
   *
   * @returns Array of scenario names
   */
  getRegisteredScenarios(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Log model selection decision
   * Requirements: 5.6
   *
   * @param scenario - Scenario name
   * @param selectedModel - Selected model
   * @param availableCount - Number of available models
   * @param strategyName - Name of the strategy used
   * @param agentContext - Optional Agent-specific context
   */
  private logSelectionDecision(
    scenario: string,
    selectedModel: ModelInfo,
    availableCount: number,
    strategyName: string,
    agentContext?: AgentSelectionContext
  ): void {
    const decision: SelectionDecision = {
      timestamp: new Date(),
      scenario,
      selectedModel: selectedModel.name,
      selectedProvider: selectedModel.provider,
      availableModelsCount: availableCount,
      strategyUsed: strategyName,
      modelCost:
        selectedModel.costPerInputToken + selectedModel.costPerOutputToken,
      modelLatency: selectedModel.latency,
      modelSuccessRate: selectedModel.successRate,
      // Agent-specific context - Requirements: 5.6
      workflowStep: agentContext?.workflowStep,
      agentType: agentContext?.agentType,
      userId: agentContext?.userId,
      optimizationEffectiveness: agentContext?.optimizationEffectiveness,
    };

    this.selectionLog.push(decision);

    const agentInfo = agentContext
      ? ` [Agent: ${agentContext.agentType}, Step: ${agentContext.workflowStep}]`
      : '';

    this.logger.debug(
      `Model selection: scenario=${scenario}, model=${selectedModel.name}, ` +
        `provider=${selectedModel.provider}, strategy=${strategyName}, ` +
        `availableModels=${availableCount}${agentInfo}`
    );
  }

  /**
   * Get selection decision log
   * Requirements: 5.7
   *
   * @param limit - Maximum number of recent decisions to return
   * @returns Array of selection decisions
   */
  getSelectionLog(limit: number = 100): SelectionDecision[] {
    return this.selectionLog.slice(-limit);
  }

  /**
   * Clear selection decision log
   */
  clearSelectionLog(): void {
    this.selectionLog = [];
  }

  /**
   * Get statistics about model selections
   *
   * @returns Statistics object
   */
  getSelectionStatistics(): SelectionStatistics {
    const stats: SelectionStatistics = {
      totalSelections: this.selectionLog.length,
      scenarioStats: {},
      modelStats: {},
      strategyStats: {},
    };

    for (const decision of this.selectionLog) {
      // Scenario statistics
      if (!stats.scenarioStats[decision.scenario]) {
        stats.scenarioStats[decision.scenario] = {
          count: 0,
          models: new Set(),
        };
      }
      stats.scenarioStats[decision.scenario].count++;
      stats.scenarioStats[decision.scenario].models.add(decision.selectedModel);

      // Model statistics
      if (!stats.modelStats[decision.selectedModel]) {
        stats.modelStats[decision.selectedModel] = {
          count: 0,
          scenarios: new Set(),
        };
      }
      stats.modelStats[decision.selectedModel].count++;
      stats.modelStats[decision.selectedModel].scenarios.add(decision.scenario);

      // Strategy statistics
      if (!stats.strategyStats[decision.strategyUsed]) {
        stats.strategyStats[decision.strategyUsed] = 0;
      }
      stats.strategyStats[decision.strategyUsed]++;
    }

    return stats;
  }
}

/**
 * Selection decision record
 * Requirements: 5.6
 */
export interface SelectionDecision {
  timestamp: Date;
  scenario: string;
  selectedModel: string;
  selectedProvider: string;
  availableModelsCount: number;
  strategyUsed: string;
  modelCost: number;
  modelLatency: number;
  modelSuccessRate: number;
  // Agent-specific context - Requirements: 5.6
  workflowStep?: string;
  agentType?: string;
  userId?: string;
  optimizationEffectiveness?: {
    costSavings?: number;
    latencySavings?: number;
    qualityImprovement?: number;
  };
}

/**
 * Selection statistics
 */
export interface SelectionStatistics {
  totalSelections: number;
  scenarioStats: Record<
    string,
    {
      count: number;
      models: Set<string>;
    }
  >;
  modelStats: Record<
    string,
    {
      count: number;
      scenarios: Set<string>;
    }
  >;
  strategyStats: Record<string, number>;
}

/**
 * Agent-specific selection context for logging
 * Requirements: 5.6
 */
export interface AgentSelectionContext {
  workflowStep?: string;
  agentType?: string;
  userId?: string;
  optimizationEffectiveness?: {
    costSavings?: number;
    latencySavings?: number;
    qualityImprovement?: number;
  };
}
