/**
 * Model Selection Strategy Interface
 * Defines the interface for different model selection strategies
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { ModelInfo } from '../interfaces';

/**
 * Selection context for model selection
 */
export interface SelectionContext {
  scenario: string; // Scenario name
  inputTokens?: number;
  maxLatency?: number;
  maxCost?: number;
}

/**
 * Model Selection Strategy Interface
 * Implementations define how to select the best model for a given context
 */
export interface ModelSelectionStrategy {
  /**
   * Select the best model from available models
   * @param availableModels - Array of available models
   * @param context - Selection context
   * @returns The selected model
   */
  selectModel(
    availableModels: ModelInfo[],
    context: SelectionContext
  ): ModelInfo;
}

/**
 * Cost Optimized Strategy
 * Selects the model with the lowest total cost (input + output tokens)
 * Used for scenarios like resume parsing where cost is the primary concern
 */
export class CostOptimizedStrategy implements ModelSelectionStrategy {
  selectModel(
    availableModels: ModelInfo[],
    context: SelectionContext
  ): ModelInfo {
    if (availableModels.length === 0) {
      throw new Error('No available models for selection');
    }

    // Filter models that meet cost constraints if specified
    let candidates = availableModels;
    if (context.maxCost !== undefined) {
      candidates = availableModels.filter(
        (m) => m.costPerInputToken + m.costPerOutputToken <= context.maxCost!
      );
      if (candidates.length === 0) {
        candidates = availableModels; // Fall back to all models if none meet cost constraint
      }
    }

    // Select the model with the lowest total cost
    return candidates.reduce((min, current) => {
      const currentCost =
        current.costPerInputToken + current.costPerOutputToken;
      const minCost = min.costPerInputToken + min.costPerOutputToken;
      return currentCost < minCost ? current : min;
    });
  }
}

/**
 * Quality Optimized Strategy
 * Selects the model with the highest quality (usually the latest/most capable model)
 * Used for scenarios like optimization suggestions where quality is the primary concern
 */
export class QualityOptimizedStrategy implements ModelSelectionStrategy {
  // Quality ranking of models (higher index = higher quality)
  private readonly qualityRanking = [
    'deepseek-chat',
    'qwen-max',
    'claude-3-opus',
    'gpt-3.5-turbo',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-4',
  ];

  selectModel(
    availableModels: ModelInfo[],
    _context: SelectionContext
  ): ModelInfo {
    if (availableModels.length === 0) {
      throw new Error('No available models for selection');
    }

    // Try to find the highest quality model in the ranking
    for (let i = this.qualityRanking.length - 1; i >= 0; i--) {
      const rankingModel = this.qualityRanking[i];
      const found = availableModels.find((m) => {
        const modelNameLower = m.name.toLowerCase();
        const rankingModelLower = rankingModel.toLowerCase();
        // Exact match or match at word boundary
        return (
          modelNameLower === rankingModelLower ||
          modelNameLower.startsWith(rankingModelLower + '-') ||
          modelNameLower.endsWith('-' + rankingModelLower)
        );
      });
      if (found) {
        return found;
      }
    }

    // If no ranked model found, return the first available model
    return availableModels[0];
  }
}

/**
 * Latency Optimized Strategy
 * Selects the model with the lowest latency (fastest response time)
 * Used for scenarios like interview question generation where speed is important
 */
export class LatencyOptimizedStrategy implements ModelSelectionStrategy {
  selectModel(
    availableModels: ModelInfo[],
    context: SelectionContext
  ): ModelInfo {
    if (availableModels.length === 0) {
      throw new Error('No available models for selection');
    }

    // Filter models that meet latency constraints if specified
    let candidates = availableModels;
    if (context.maxLatency !== undefined) {
      candidates = availableModels.filter(
        (m) => m.latency <= context.maxLatency!
      );
      if (candidates.length === 0) {
        candidates = availableModels; // Fall back to all models if none meet latency constraint
      }
    }

    // Select the model with the lowest latency
    return candidates.reduce((min, current) =>
      current.latency < min.latency ? current : min
    );
  }
}

/**
 * Balanced Strategy
 * Selects a model that balances cost, quality, and latency
 * Used for general-purpose scenarios
 */
export class BalancedStrategy implements ModelSelectionStrategy {
  selectModel(
    availableModels: ModelInfo[],
    _context: SelectionContext
  ): ModelInfo {
    if (availableModels.length === 0) {
      throw new Error('No available models for selection');
    }

    // Normalize metrics to 0-1 range for scoring
    const maxCost = Math.max(
      ...availableModels.map((m) => m.costPerInputToken + m.costPerOutputToken)
    );
    const maxLatency = Math.max(...availableModels.map((m) => m.latency));

    // Calculate balanced score for each model
    // Lower cost and latency are better, higher success rate is better
    const scores = availableModels.map((model) => {
      const costScore =
        (model.costPerInputToken + model.costPerOutputToken) / (maxCost || 1);
      const latencyScore = model.latency / (maxLatency || 1);
      const qualityScore = model.successRate;

      // Weighted average: 40% cost, 30% latency, 30% quality
      return 0.4 * costScore + 0.3 * latencyScore + 0.3 * (1 - qualityScore);
    });

    // Return model with lowest score (best balance)
    let bestIndex = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] < scores[bestIndex]) {
        bestIndex = i;
      }
    }

    return availableModels[bestIndex];
  }
}
