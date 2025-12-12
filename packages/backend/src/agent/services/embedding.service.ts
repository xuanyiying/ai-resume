/**
 * Embedding Service
 * Generates embeddings for documents using OpenAI or local models
 * Caches embeddings for performance
 * Requirements: 9.2
 */

import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { RedisService } from '../../redis/redis.service';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly EMBEDDING_CACHE_TTL = 86400; // 24 hours
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small'; // Default OpenAI model

  constructor(
    private aiEngineService: AIEngineService,
    private redisService: RedisService
  ) {}

  /**
   * Generate embedding for text
   * Uses cache to avoid redundant API calls
   * Property 33: Embedding Storage Completeness
   * Validates: Requirements 9.2
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Create cache key from text hash
      const cacheKey = this.getCacheKey(text);

      // Check cache first
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for embedding: ${cacheKey}`);
        return JSON.parse(cached);
      }

      // Generate embedding via AIEngineService
      // Using a special scenario for embeddings
      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt: text,
          metadata: {
            embeddingModel: this.EMBEDDING_MODEL,
          },
        },
        'system',
        'embedding-generation'
      );

      // Parse embedding from response
      // The response should contain the embedding vector
      let embedding: number[];
      try {
        const parsed = JSON.parse(response.content);
        embedding = parsed.embedding || parsed;
      } catch {
        // If not JSON, treat as error
        throw new Error('Invalid embedding response format');
      }

      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding: must be non-empty array');
      }

      // Cache the embedding
      await this.redisService.set(
        cacheKey,
        JSON.stringify(embedding),
        this.EMBEDDING_CACHE_TTL
      );

      this.logger.debug(
        `Generated embedding for text (${text.length} chars): ${embedding.length} dimensions`
      );

      return embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   * Batch processing for efficiency
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text);
        results.push({
          embedding,
          model: this.EMBEDDING_MODEL,
          tokens: Math.ceil(text.length / 4), // Rough estimate
        });
      } catch (error) {
        this.logger.error(
          `Failed to generate embedding for text: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }

    return results;
  }

  /**
   * Calculate similarity between two embeddings using cosine similarity
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Generate cache key from text
   */
  private getCacheKey(text: string): string {
    // Use a simple hash of the text for cache key
    const hash = this.simpleHash(text);
    return `embedding:${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
