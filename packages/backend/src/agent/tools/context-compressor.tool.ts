import { Tool } from '@langchain/core/tools';
import {
  ContextCompressorService,
  Message,
  CompressionResult,
} from '../services/context-compressor.service';

export interface CompressionInput {
  messages: Message[];
  maxTokens?: number;
  strategy?: 'simple' | 'sliding-window';
}

/**
 * Context Compressor Tool
 * Compresses conversation history to reduce token usage
 * Requirements: 1.4, 6.1
 */
export class ContextCompressorTool extends Tool {
  name = 'context_compressor';
  description = 'Compresses conversation history to reduce token usage';

  constructor(private contextCompressorService: ContextCompressorService) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const parsedInput: CompressionInput = JSON.parse(input);
      const strategy = parsedInput.strategy || 'simple';
      const maxTokens = parsedInput.maxTokens || 500;

      let result: CompressionResult | Message[];

      if (strategy === 'sliding-window') {
        result = await this.contextCompressorService.compressWithSlidingWindow(
          parsedInput.messages,
          5,
          maxTokens
        );
      } else {
        result = await this.contextCompressorService.compress(
          parsedInput.messages,
          maxTokens
        );
      }

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Failed to compress context: ${errorMessage}`,
        compressed: '',
        originalTokens: 0,
        compressedTokens: 0,
        compressionRatio: 0,
      });
    }
  }
}
