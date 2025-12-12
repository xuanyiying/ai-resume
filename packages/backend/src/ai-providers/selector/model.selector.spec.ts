/**
 * Model Selector Tests
 * Tests for model selection strategies and selector implementation
 * **Feature: multi-llm-provider-integration, Property 22: 场景选择策略定义, Property 23: 简历解析成本优化, Property 24: 优化建议质量优化, Property 25: 面试问题速度优化, Property 26: 模型自动切换, Property 27: 降级响应, Property 28: 模型选择日志**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
 */

import { ModelInfo } from '../interfaces';
import { ModelSelector, ScenarioType } from './model.selector';
import {
  CostOptimizedStrategy,
  QualityOptimizedStrategy,
  LatencyOptimizedStrategy,
  BalancedStrategy,
} from './model-selection.strategy';

describe('ModelSelector', () => {
  let selector: ModelSelector;

  // Mock model data
  const mockModels: ModelInfo[] = [
    {
      name: 'gpt-3.5-turbo',
      provider: 'openai',
      contextWindow: 4096,
      costPerInputToken: 0.0005,
      costPerOutputToken: 0.0015,
      latency: 500,
      successRate: 0.95,
      isAvailable: true,
    },
    {
      name: 'gpt-4',
      provider: 'openai',
      contextWindow: 8192,
      costPerInputToken: 0.03,
      costPerOutputToken: 0.06,
      latency: 2000,
      successRate: 0.99,
      isAvailable: true,
    },
    {
      name: 'qwen-max',
      provider: 'qwen',
      contextWindow: 8192,
      costPerInputToken: 0.001,
      costPerOutputToken: 0.002,
      latency: 800,
      successRate: 0.92,
      isAvailable: true,
    },
    {
      name: 'deepseek-chat',
      provider: 'deepseek',
      contextWindow: 4096,
      costPerInputToken: 0.0008,
      costPerOutputToken: 0.0012,
      latency: 600,
      successRate: 0.9,
      isAvailable: true,
    },
    {
      name: 'llama-2',
      provider: 'ollama',
      contextWindow: 4096,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      latency: 1500,
      successRate: 0.85,
      isAvailable: true,
    },
  ];

  const unavailableModel: ModelInfo = {
    name: 'gpt-4-turbo',
    provider: 'openai',
    contextWindow: 128000,
    costPerInputToken: 0.01,
    costPerOutputToken: 0.03,
    latency: 1000,
    successRate: 0.98,
    isAvailable: false,
  };

  beforeEach(() => {
    selector = new ModelSelector();
  });

  describe('Initialization', () => {
    it('should initialize with default strategies', () => {
      const scenarios = selector.getRegisteredScenarios();
      expect(scenarios).toContain(ScenarioType.RESUME_PARSING);
      expect(scenarios).toContain(ScenarioType.RESUME_OPTIMIZATION);
      expect(scenarios).toContain(ScenarioType.INTERVIEW_QUESTION_GENERATION);
      expect(scenarios).toContain(ScenarioType.MATCH_SCORE_CALCULATION);
      expect(scenarios).toContain(ScenarioType.GENERAL);
    });

    it('should have correct strategy for each scenario', () => {
      const resumeParsingStrategy = selector.getStrategy(
        ScenarioType.RESUME_PARSING
      );
      expect(resumeParsingStrategy).toBeInstanceOf(CostOptimizedStrategy);

      const resumeOptimizationStrategy = selector.getStrategy(
        ScenarioType.RESUME_OPTIMIZATION
      );
      expect(resumeOptimizationStrategy).toBeInstanceOf(
        QualityOptimizedStrategy
      );

      const interviewStrategy = selector.getStrategy(
        ScenarioType.INTERVIEW_QUESTION_GENERATION
      );
      expect(interviewStrategy).toBeInstanceOf(LatencyOptimizedStrategy);

      const matchScoreStrategy = selector.getStrategy(
        ScenarioType.MATCH_SCORE_CALCULATION
      );
      expect(matchScoreStrategy).toBeInstanceOf(BalancedStrategy);
    });
  });

  describe('Property 22: Scenario Selection Strategy Definition', () => {
    it('should define strategy for resume parsing scenario', () => {
      const strategy = selector.getStrategy(ScenarioType.RESUME_PARSING);
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(CostOptimizedStrategy);
    });

    it('should define strategy for resume optimization scenario', () => {
      const strategy = selector.getStrategy(ScenarioType.RESUME_OPTIMIZATION);
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(QualityOptimizedStrategy);
    });

    it('should define strategy for interview question generation scenario', () => {
      const strategy = selector.getStrategy(
        ScenarioType.INTERVIEW_QUESTION_GENERATION
      );
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(LatencyOptimizedStrategy);
    });

    it('should define strategy for match score calculation scenario', () => {
      const strategy = selector.getStrategy(
        ScenarioType.MATCH_SCORE_CALCULATION
      );
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(BalancedStrategy);
    });

    it('should allow registering custom strategies', () => {
      const customStrategy = new CostOptimizedStrategy();
      selector.registerStrategy('custom-scenario', customStrategy);

      const registered = selector.getStrategy('custom-scenario');
      expect(registered).toBe(customStrategy);
    });
  });

  describe('Property 23: Resume Parsing Cost Optimization', () => {
    it('should select lowest cost model for resume parsing', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_PARSING
      );

      // llama-2 has lowest total cost (0 + 0 = 0)
      expect(selected.name).toBe('llama-2');
      expect(selected.provider).toBe('ollama');
    });

    it('should select cost-optimized model even if not highest quality', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_PARSING
      );

      // Should select llama-2 (lowest cost) not gpt-4 (highest quality)
      expect(
        selected.costPerInputToken + selected.costPerOutputToken
      ).toBeLessThan(
        0.01 // gpt-4 cost
      );
    });

    it('should respect cost constraint if provided', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_PARSING,
        { maxCost: 0.002 }
      );

      // Should select model with cost <= 0.002
      expect(
        selected.costPerInputToken + selected.costPerOutputToken
      ).toBeLessThanOrEqual(0.002);
    });

    it('should fall back to all models if no model meets cost constraint', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_PARSING,
        { maxCost: 0.0001 } // Impossible constraint
      );

      // Should still select the cheapest model
      expect(selected.name).toBe('llama-2');
    });
  });

  describe('Property 24: Resume Optimization Quality Optimization', () => {
    it('should select highest quality model for resume optimization', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_OPTIMIZATION
      );

      // Should select gpt-4 (highest quality in available models)
      expect(selected.name).toBe('gpt-4');
      expect(selected.provider).toBe('openai');
    });

    it('should prefer gpt-4 over gpt-3.5-turbo', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_OPTIMIZATION
      );

      expect(selected.name).toBe('gpt-4');
    });

    it('should select quality model even if more expensive', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_OPTIMIZATION
      );

      // gpt-4 is more expensive than llama-2
      expect(selected.costPerInputToken).toBeGreaterThan(0);
    });

    it('should follow quality ranking order', () => {
      const modelsWithRanked = [
        ...mockModels,
        {
          name: 'claude-3-opus',
          provider: 'anthropic',
          contextWindow: 200000,
          costPerInputToken: 0.015,
          costPerOutputToken: 0.075,
          latency: 3000,
          successRate: 0.99,
          isAvailable: true,
        },
      ];

      const selected = selector.selectModel(
        modelsWithRanked,
        ScenarioType.RESUME_OPTIMIZATION
      );

      // Should prefer gpt-4 (highest in ranking among available models)
      expect(selected.name).toBe('gpt-4');
    });
  });

  describe('Property 25: Interview Question Generation Latency Optimization', () => {
    it('should select fastest model for interview question generation', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.INTERVIEW_QUESTION_GENERATION
      );

      // gpt-3.5-turbo has lowest latency (500ms)
      expect(selected.name).toBe('gpt-3.5-turbo');
      expect(selected.latency).toBe(500);
    });

    it('should select low-latency model even if lower quality', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.INTERVIEW_QUESTION_GENERATION
      );

      // Should select gpt-3.5-turbo (fastest) not gpt-4 (highest quality)
      expect(selected.latency).toBeLessThan(1000);
    });

    it('should respect latency constraint if provided', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.INTERVIEW_QUESTION_GENERATION,
        { maxLatency: 700 }
      );

      // Should select model with latency <= 700ms
      expect(selected.latency).toBeLessThanOrEqual(700);
    });

    it('should fall back to all models if no model meets latency constraint', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.INTERVIEW_QUESTION_GENERATION,
        { maxLatency: 100 } // Impossible constraint
      );

      // Should still select the fastest model
      expect(selected.name).toBe('gpt-3.5-turbo');
    });
  });

  describe('Property 26: Model Auto-Switching', () => {
    it('should skip unavailable models', () => {
      const modelsWithUnavailable = [...mockModels, unavailableModel];

      const selected = selector.selectModel(
        modelsWithUnavailable,
        ScenarioType.RESUME_PARSING
      );

      // Should not select unavailable model
      expect(selected.isAvailable).toBe(true);
    });

    it('should switch to available model when preferred is unavailable', () => {
      const modelsWithUnavailableQwen = mockModels.map((m) =>
        m.name === 'qwen-max' ? { ...m, isAvailable: false } : m
      );

      const selected = selector.selectModel(
        modelsWithUnavailableQwen,
        ScenarioType.RESUME_PARSING
      );

      // Should select next cheapest available model
      expect(selected.isAvailable).toBe(true);
      expect(selected.name).not.toBe('qwen-max');
    });

    it('should use fallback when all models are unavailable', () => {
      const allUnavailable = mockModels.map((m) => ({
        ...m,
        isAvailable: false,
      }));

      const selected = selector.selectModel(
        allUnavailable,
        ScenarioType.RESUME_PARSING
      );

      // Should return first model (degraded mode)
      expect(selected.name).toBe('gpt-3.5-turbo');
    });

    it('should throw error when no models available at all', () => {
      expect(() => {
        selector.selectModel([], ScenarioType.RESUME_PARSING);
      }).toThrow('No models available for scenario');
    });
  });

  describe('Property 27: Degradation Response', () => {
    it('should handle empty model list gracefully', () => {
      expect(() => {
        selector.selectModel([], ScenarioType.RESUME_PARSING);
      }).toThrow();
    });

    it('should use fallback strategy for unknown scenario', () => {
      const selected = selector.selectModel(mockModels, 'unknown-scenario');

      // Should use general strategy (balanced)
      expect(selected).toBeDefined();
      expect(selected.isAvailable).toBe(true);
    });

    it('should return first available model when all unavailable', () => {
      const allUnavailable = mockModels.map((m) => ({
        ...m,
        isAvailable: false,
      }));

      const selected = selector.selectModel(
        allUnavailable,
        ScenarioType.RESUME_PARSING
      );

      expect(selected.name).toBe('gpt-3.5-turbo');
    });
  });

  describe('Property 28: Model Selection Logging', () => {
    it('should log selection decisions', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);

      const log = selector.getSelectionLog();
      expect(log.length).toBeGreaterThan(0);
    });

    it('should record correct information in selection log', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision).toHaveProperty('timestamp');
      expect(decision).toHaveProperty('scenario');
      expect(decision).toHaveProperty('selectedModel');
      expect(decision).toHaveProperty('selectedProvider');
      expect(decision).toHaveProperty('availableModelsCount');
      expect(decision).toHaveProperty('strategyUsed');
      expect(decision).toHaveProperty('modelCost');
      expect(decision).toHaveProperty('modelLatency');
      expect(decision).toHaveProperty('modelSuccessRate');
    });

    it('should log correct scenario and model', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision.scenario).toBe(ScenarioType.RESUME_PARSING);
      expect(decision.selectedModel).toBe('llama-2');
      expect(decision.selectedProvider).toBe('ollama');
    });

    it('should log correct strategy used', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision.strategyUsed).toBe('CostOptimizedStrategy');
    });

    it('should log available models count', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision.availableModelsCount).toBe(mockModels.length);
    });

    it('should maintain log history', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_OPTIMIZATION);
      selector.selectModel(
        mockModels,
        ScenarioType.INTERVIEW_QUESTION_GENERATION
      );

      const log = selector.getSelectionLog();
      expect(log.length).toBe(3);
    });

    it('should limit log size with limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      }

      const log = selector.getSelectionLog(5);
      expect(log.length).toBe(5);
    });

    it('should clear selection log', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      expect(selector.getSelectionLog().length).toBeGreaterThan(0);

      selector.clearSelectionLog();
      expect(selector.getSelectionLog().length).toBe(0);
    });
  });

  describe('Selection Statistics', () => {
    it('should generate selection statistics', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_OPTIMIZATION);

      const stats = selector.getSelectionStatistics();

      expect(stats).toHaveProperty('totalSelections');
      expect(stats).toHaveProperty('scenarioStats');
      expect(stats).toHaveProperty('modelStats');
      expect(stats).toHaveProperty('strategyStats');
    });

    it('should track scenario statistics', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_OPTIMIZATION);

      const stats = selector.getSelectionStatistics();

      expect(stats.scenarioStats[ScenarioType.RESUME_PARSING].count).toBe(2);
      expect(stats.scenarioStats[ScenarioType.RESUME_OPTIMIZATION].count).toBe(
        1
      );
    });

    it('should track model statistics', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_OPTIMIZATION);

      const stats = selector.getSelectionStatistics();

      expect(stats.modelStats['llama-2'].count).toBe(2);
      expect(stats.modelStats['gpt-4'].count).toBe(1);
    });

    it('should track strategy statistics', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);
      selector.selectModel(mockModels, ScenarioType.RESUME_OPTIMIZATION);

      const stats = selector.getSelectionStatistics();

      expect(stats.strategyStats['CostOptimizedStrategy']).toBe(1);
      expect(stats.strategyStats['QualityOptimizedStrategy']).toBe(1);
    });
  });

  describe('Custom Strategy Registration', () => {
    it('should register and use custom strategy', () => {
      const customStrategy = new LatencyOptimizedStrategy();
      selector.registerStrategy('custom-scenario', customStrategy);

      const selected = selector.selectModel(mockModels, 'custom-scenario');

      // Should use latency optimization
      expect(selected.name).toBe('gpt-3.5-turbo');
    });

    it('should override default strategy', () => {
      const customStrategy = new LatencyOptimizedStrategy();
      selector.registerStrategy(ScenarioType.RESUME_PARSING, customStrategy);

      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_PARSING
      );

      // Should use latency optimization instead of cost
      expect(selected.name).toBe('gpt-3.5-turbo');
    });
  });

  describe('Balanced Strategy', () => {
    it('should select balanced model for general scenario', () => {
      const selected = selector.selectModel(mockModels, ScenarioType.GENERAL);

      // Should select a model that balances cost, latency, and quality
      expect(selected).toBeDefined();
      expect(selected.isAvailable).toBe(true);
    });

    it('should consider cost, latency, and quality in balanced strategy', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.MATCH_SCORE_CALCULATION
      );

      // Should not be the most expensive (gpt-4)
      // Should not be the slowest (llama-2)
      // Should not be the cheapest (ollama)
      expect(selected.name).not.toBe('gpt-4');
      expect(selected.name).not.toBe('llama-2');
    });
  });

  describe('Property 21: Agent Scenario Routing', () => {
    it('should define strategy for STAR extraction scenario', () => {
      const strategy = selector.getStrategy(ScenarioType.AGENT_STAR_EXTRACTION);
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(CostOptimizedStrategy);
    });

    it('should define strategy for introduction generation scenario', () => {
      const strategy = selector.getStrategy(
        ScenarioType.AGENT_INTRODUCTION_GENERATION
      );
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(QualityOptimizedStrategy);
    });

    it('should define strategy for response processing scenario', () => {
      const strategy = selector.getStrategy(
        ScenarioType.AGENT_RESPONSE_PROCESSING
      );
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(LatencyOptimizedStrategy);
    });

    it('should define strategy for context compression scenario', () => {
      const strategy = selector.getStrategy(
        ScenarioType.AGENT_CONTEXT_COMPRESSION
      );
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(CostOptimizedStrategy);
    });

    it('should define strategy for RAG retrieval scenario', () => {
      const strategy = selector.getStrategy(ScenarioType.AGENT_RAG_RETRIEVAL);
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(CostOptimizedStrategy);
    });

    it('should select cost-optimized model for STAR extraction', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.AGENT_STAR_EXTRACTION
      );

      // Should select lowest cost model
      expect(selected.name).toBe('llama-2');
    });

    it('should select quality-optimized model for introduction generation', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.AGENT_INTRODUCTION_GENERATION
      );

      // Should select highest quality model
      expect(selected.name).toBe('gpt-4');
    });

    it('should select latency-optimized model for response processing', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.AGENT_RESPONSE_PROCESSING
      );

      // Should select fastest model
      expect(selected.name).toBe('gpt-3.5-turbo');
    });

    it('should select cost-optimized model for context compression', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.AGENT_CONTEXT_COMPRESSION
      );

      // Should select lowest cost model
      expect(selected.name).toBe('llama-2');
    });

    it('should select cost-optimized model for RAG retrieval', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.AGENT_RAG_RETRIEVAL
      );

      // Should select lowest cost model
      expect(selected.name).toBe('llama-2');
    });
  });

  describe('Property 22: Agent Selection Logging', () => {
    it('should log Agent-specific context in selection decision', () => {
      const agentContext = {
        agentType: 'pitch-perfect',
        workflowStep: 'introduction-generation',
        userId: 'user-123',
      };

      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_INTRODUCTION_GENERATION,
        undefined,
        agentContext
      );

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision.agentType).toBe('pitch-perfect');
      expect(decision.workflowStep).toBe('introduction-generation');
      expect(decision.userId).toBe('user-123');
    });

    it('should log optimization effectiveness metrics', () => {
      const agentContext = {
        agentType: 'strategist',
        workflowStep: 'question-generation',
        optimizationEffectiveness: {
          costSavings: 0.5,
          latencySavings: 0.3,
        },
      };

      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_CUSTOM_QUESTION_GENERATION,
        undefined,
        agentContext
      );

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision.optimizationEffectiveness?.costSavings).toBe(0.5);
      expect(decision.optimizationEffectiveness?.latencySavings).toBe(0.3);
    });

    it('should include workflow step in debug log', () => {
      const agentContext = {
        agentType: 'role-play',
        workflowStep: 'response-analysis',
      };

      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_RESPONSE_ANALYSIS,
        undefined,
        agentContext
      );

      const log = selector.getSelectionLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].workflowStep).toBe('response-analysis');
    });

    it('should track multiple Agent selections with different contexts', () => {
      const context1 = {
        agentType: 'pitch-perfect',
        workflowStep: 'star-extraction',
      };
      const context2 = {
        agentType: 'strategist',
        workflowStep: 'question-generation',
      };

      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_STAR_EXTRACTION,
        undefined,
        context1
      );
      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_CUSTOM_QUESTION_GENERATION,
        undefined,
        context2
      );

      const log = selector.getSelectionLog();
      expect(log.length).toBe(2);
      expect(log[0].agentType).toBe('pitch-perfect');
      expect(log[1].agentType).toBe('strategist');
    });

    it('should handle selection without Agent context', () => {
      selector.selectModel(mockModels, ScenarioType.RESUME_PARSING);

      const log = selector.getSelectionLog();
      const decision = log[0];

      expect(decision.agentType).toBeUndefined();
      expect(decision.workflowStep).toBeUndefined();
    });

    it('should include all Agent scenarios in statistics', () => {
      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_STAR_EXTRACTION,
        undefined,
        { agentType: 'pitch-perfect' }
      );
      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_INTRODUCTION_GENERATION,
        undefined,
        { agentType: 'pitch-perfect' }
      );
      selector.selectModel(
        mockModels,
        ScenarioType.AGENT_CUSTOM_QUESTION_GENERATION,
        undefined,
        { agentType: 'strategist' }
      );

      const stats = selector.getSelectionStatistics();

      expect(
        stats.scenarioStats[ScenarioType.AGENT_STAR_EXTRACTION]
      ).toBeDefined();
      expect(
        stats.scenarioStats[ScenarioType.AGENT_INTRODUCTION_GENERATION]
      ).toBeDefined();
      expect(
        stats.scenarioStats[ScenarioType.AGENT_CUSTOM_QUESTION_GENERATION]
      ).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single model', () => {
      const singleModel = [mockModels[0]];

      const selected = selector.selectModel(
        singleModel,
        ScenarioType.RESUME_PARSING
      );

      expect(selected).toBe(singleModel[0]);
    });

    it('should handle models with zero cost', () => {
      const selected = selector.selectModel(
        mockModels,
        ScenarioType.RESUME_PARSING
      );

      // Should still select a model
      expect(selected).toBeDefined();
    });

    it('should handle models with same cost', () => {
      const sameCoastModels = [
        {
          ...mockModels[0],
          costPerInputToken: 0.001,
          costPerOutputToken: 0.002,
        },
        {
          ...mockModels[1],
          costPerInputToken: 0.001,
          costPerOutputToken: 0.002,
        },
      ];

      const selected = selector.selectModel(
        sameCoastModels,
        ScenarioType.RESUME_PARSING
      );

      expect(selected).toBeDefined();
      expect(selected.costPerInputToken + selected.costPerOutputToken).toBe(
        0.003
      );
    });

    it('should handle models with same latency', () => {
      const sameLatencyModels = [
        { ...mockModels[0], latency: 500 },
        { ...mockModels[1], latency: 500 },
      ];

      const selected = selector.selectModel(
        sameLatencyModels,
        ScenarioType.INTERVIEW_QUESTION_GENERATION
      );

      expect(selected).toBeDefined();
      expect(selected.latency).toBe(500);
    });
  });
});
