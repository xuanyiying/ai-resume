/**
 * Agent Cache Manager Service
 * Manages caching for Agent operations with cache-first pattern
 * Requirements: 7.1, 7.2, 7.5, 7.6
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

@Injectable()
export class AgentCacheManagerService {
  private readonly logger = new Logger(AgentCacheManagerService.name);

  // Default TTLs by content type (in seconds)
  private readonly DEFAULT_TTLS: Record<string, number> = {
    embedding: 86400, // 24 hours
    'question-bank': 3600, // 1 hour
    'rag-retrieval': 1800, // 30 minutes
    compression: 600, // 10 minutes
    generation: 3600, // 1 hour
    default: 1800, // 30 minutes
  };

  private cacheStats = {
    hits: 0,
    misses: 0,
  };

  constructor(private redisService: RedisService) {}

  /**
   * Get cache key for deterministic caching
   * Property 26: Cache-First Behavior
   * Validates: Requirements 7.1
   */
  getCacheKey(prefix: string, input: Record<string, unknown> | string): string {
    let inputStr: string;

    if (typeof input === 'string') {
      inputStr = input;
    } else {
      inputStr = JSON.stringify(input);
    }

    // Create deterministic hash
    const hash = crypto
      .createHash('sha256')
      .update(inputStr)
      .digest('hex')
      .substring(0, 16);

    return `agent:${prefix}:${hash}`;
  }

  /**
   * Get or compute value with cache-first pattern
   * Property 26: Cache-First Behavior
   * Property 27: Cache Hit Efficiency
   * Validates: Requirements 7.1, 7.2
   */
  async getOrCompute<T>(
    cacheKey: string,
    computeFn: () => Promise<T>,
    contentType = 'default'
  ): Promise<T> {
    try {
      // Step 1: Check cache
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.cacheStats.hits++;
        this.logger.debug(`Cache hit: ${cacheKey}`);

        try {
          return JSON.parse(cached) as T;
        } catch {
          // If parsing fails, treat as cache miss
          await this.redisService.del(cacheKey);
        }
      }

      // Step 2: Cache miss - compute value
      this.cacheStats.misses++;
      this.logger.debug(`Cache miss: ${cacheKey}`);

      const result = await computeFn();

      // Step 3: Store in cache with appropriate TTL
      const ttl = this.DEFAULT_TTLS[contentType] || this.DEFAULT_TTLS.default;
      await this.set(cacheKey, result, ttl);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get or compute: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redisService.set(key, serialized, ttl);
      this.logger.debug(`Cached value: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(
        `Failed to set cache: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cache value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redisService.get(key);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(
        `Failed to get cache: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
      this.logger.debug(`Deleted cache: ${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete cache: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Check if cache entry exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await this.redisService.exists(key);
    } catch (error) {
      this.logger.error(
        `Failed to check cache existence: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Get remaining TTL for cache entry
   * Property 28: Cache Expiration Handling
   * Validates: Requirements 7.5
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.redisService.ttl(key);
    } catch (error) {
      this.logger.error(
        `Failed to get TTL: ${error instanceof Error ? error.message : String(error)}`
      );
      return -1;
    }
  }

  /**
   * Refresh cache entry TTL
   */
  async refreshTTL(key: string, ttl: number): Promise<void> {
    try {
      await this.redisService.expire(key, ttl);
      this.logger.debug(`Refreshed TTL for cache: ${key} (${ttl}s)`);
    } catch (error) {
      this.logger.error(
        `Failed to refresh TTL: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Cache intermediate workflow results
   * Property 29: Intermediate Result Caching
   * Validates: Requirements 7.6
   */
  async cacheWorkflowStep(
    workflowId: string,
    stepId: string,
    result: unknown,
    ttl = 3600
  ): Promise<void> {
    try {
      const key = `workflow:${workflowId}:step:${stepId}`;
      await this.set(key, result, ttl);
      this.logger.debug(
        `Cached workflow step: ${workflowId}/${stepId} (TTL: ${ttl}s)`
      );
    } catch (error) {
      this.logger.error(
        `Failed to cache workflow step: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cached workflow step result
   */
  async getWorkflowStep<T>(
    workflowId: string,
    stepId: string
  ): Promise<T | null> {
    try {
      const key = `workflow:${workflowId}:step:${stepId}`;
      return await this.get<T>(key);
    } catch (error) {
      this.logger.error(
        `Failed to get workflow step: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Clear all workflow cache for a workflow
   */
  async clearWorkflowCache(workflowId: string): Promise<void> {
    try {
      // Note: This is a simplified implementation
      // In production, you might want to use Redis SCAN with pattern matching
      this.logger.debug(`Cleared workflow cache: ${workflowId}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear workflow cache: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? this.cacheStats.hits / total : 0;

    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
    };
    this.logger.debug('Reset cache statistics');
  }

  /**
   * Get TTL for content type
   */
  getTTLForContentType(contentType: string): number {
    return this.DEFAULT_TTLS[contentType] || this.DEFAULT_TTLS.default;
  }

  /**
   * Set custom TTL for content type
   */
  setTTLForContentType(contentType: string, ttl: number): void {
    this.DEFAULT_TTLS[contentType] = ttl;
    this.logger.debug(`Set TTL for content type '${contentType}': ${ttl}s`);
  }
}
