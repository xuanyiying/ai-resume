/**
 * Core AI Provider Interface
 * Defines the unified interface that all AI providers must implement
 * Requirements: 2.1, 2.3, 2.4
 */

/**
 * AI Request structure
 * Unified request format for all AI providers
 */
export interface AIRequest {
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  metadata?: Record<string, unknown>;
}

/**
 * AI Response structure
 * Unified response format from all AI providers
 */
export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  metadata?: Record<string, unknown>;
}

/**
 * AI Stream Chunk structure
 * Unified streaming response format
 */
export interface AIStreamChunk {
  content: string;
  model: string;
  provider: string;
  finishReason?: string;
}

/**
 * Model Information structure
 * Contains metadata about a specific model
 */
export interface ModelInfo {
  name: string;
  provider: string;
  contextWindow: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  latency: number; // Average latency in milliseconds
  successRate: number; // Success rate (0-1)
  isAvailable: boolean;
}

/**
 * AI Provider Interface
 * All AI providers must implement this interface
 */
export interface AIProvider {
  /**
   * Provider name (e.g., 'openai', 'qwen', 'deepseek', 'gemini', 'ollama')
   */
  readonly name: string;

  /**
   * Call AI with a request and get a response
   * @param request - The AI request
   * @returns Promise resolving to AI response
   */
  call(request: AIRequest): Promise<AIResponse>;

  /**
   * Stream AI response
   * @param request - The AI request
   * @returns Async iterable of stream chunks
   */
  stream(request: AIRequest): AsyncIterable<AIStreamChunk>;

  /**
   * Check if the provider is available and healthy
   * @returns Promise resolving to true if healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get list of available models from this provider
   * @returns Promise resolving to array of model names
   */
  listModels(): Promise<string[]>;

  /**
   * Get detailed information about a specific model
   * @param modelName - Name of the model
   * @returns Promise resolving to model information
   */
  getModelInfo(modelName: string): Promise<ModelInfo>;
}
