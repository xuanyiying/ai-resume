/**
 * Context Compressor Service
 * Compresses dialogue history and long contexts to reduce token usage
 * Requirements: 6.1, 6.2
 */

import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface CompressionResult {
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
}

@Injectable()
export class ContextCompressorService {
  private readonly logger = new Logger(ContextCompressorService.name);
  private readonly DEFAULT_MAX_TOKENS = 500;
  private readonly COMPRESSION_THRESHOLD = 2000; // Compress if context exceeds this

  constructor(private aiEngineService: AIEngineService) {}

  /**
   * Compress conversation history using sliding window strategy
   * Property 16: Dialogue History Compression
   * Property 25: Threshold-Triggered Compression
   * Validates: Requirements 4.3, 6.1, 6.2, 6.5
   */
  async compress(
    messages: Message[],
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Promise<CompressionResult> {
    try {
      // Convert messages to text
      const fullHistory = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      // Estimate tokens (rough: 1 token ≈ 4 characters)
      const originalTokens = Math.ceil(fullHistory.length / 4);

      // If already small, return as-is
      if (originalTokens <= maxTokens) {
        return {
          compressed: fullHistory,
          originalTokens,
          compressedTokens: originalTokens,
          compressionRatio: 1,
        };
      }

      // Use cost-optimized model for compression
      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt: `Summarize the following conversation in ${maxTokens} tokens or less, preserving key information, decisions, and user preferences:\n\n${fullHistory}`,
          maxTokens,
        },
        'system',
        'context-compression'
      );

      const compressed = response.content;
      const compressedTokens = response.usage.outputTokens;
      const compressionRatio = originalTokens / compressedTokens;

      this.logger.debug(
        `Compressed context: ${originalTokens} → ${compressedTokens} tokens (ratio: ${compressionRatio.toFixed(2)}x)`
      );

      return {
        compressed,
        originalTokens,
        compressedTokens,
        compressionRatio,
      };
    } catch (error) {
      this.logger.error(
        `Failed to compress context: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Apply sliding window compression strategy
   * Keeps recent messages and compresses older ones
   * Property 23: Context Compression Preservation
   * Validates: Requirements 6.2
   */
  async compressWithSlidingWindow(
    messages: Message[],
    windowSize: number = 5,
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Promise<Message[]> {
    try {
      if (messages.length <= windowSize) {
        return messages;
      }

      // Keep recent messages
      const recentMessages = messages.slice(-windowSize);
      const olderMessages = messages.slice(0, -windowSize);

      // Compress older messages
      const compressionResult = await this.compress(olderMessages, maxTokens);

      // Create a summary message
      const summaryMessage: Message = {
        role: 'system',
        content: `[CONVERSATION SUMMARY]\n${compressionResult.compressed}`,
      };

      // Return compressed history
      return [summaryMessage, ...recentMessages];
    } catch (error) {
      this.logger.error(
        `Failed to apply sliding window compression: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Check if context needs compression
   * Property 25: Threshold-Triggered Compression
   * Validates: Requirements 6.5
   */
  shouldCompress(messages: Message[]): boolean {
    const fullHistory = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const estimatedTokens = Math.ceil(fullHistory.length / 4);
    return estimatedTokens > this.COMPRESSION_THRESHOLD;
  }

  /**
   * Estimate token count for messages
   */
  estimateTokenCount(messages: Message[]): number {
    const fullHistory = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return Math.ceil(fullHistory.length / 4);
  }

  /**
   * Compress if needed
   * Automatically applies compression if threshold is exceeded
   */
  async compressIfNeeded(
    messages: Message[],
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Promise<{ messages: Message[]; compressed: boolean }> {
    try {
      if (!this.shouldCompress(messages)) {
        return { messages, compressed: false };
      }

      const compressedMessages = await this.compressWithSlidingWindow(
        messages,
        5,
        maxTokens
      );

      return { messages: compressedMessages, compressed: true };
    } catch (error) {
      this.logger.error(
        `Failed to compress if needed: ${error instanceof Error ? error.message : String(error)}`
      );
      // Return original messages on error
      return { messages, compressed: false };
    }
  }

  /**
   * Summarize messages into key points
   */
  async summarizeKeyPoints(messages: Message[]): Promise<string[]> {
    try {
      const fullHistory = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt: `Extract the key points from this conversation as a bullet list:\n\n${fullHistory}`,
          maxTokens: 500,
        },
        'system',
        'context-compression'
      );

      // Parse bullet points
      const keyPoints = response.content
        .split('\n')
        .filter(
          (line) => line.trim().startsWith('-') || line.trim().startsWith('•')
        )
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter((line) => line.length > 0);

      return keyPoints;
    } catch (error) {
      this.logger.error(
        `Failed to summarize key points: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
