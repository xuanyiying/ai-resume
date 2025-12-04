/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 * Requirements: 1.6, 1.7, 3.3, 3.4
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIProvider } from '../interfaces';
import { ModelConfigService } from '../config/model-config.service';
import { QwenProvider } from '../providers/qwen.provider';
import { OllamaProvider } from '../providers/ollama.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { DeepSeekProvider } from '../providers/deepseek.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import {
  QwenConfig,
  OllamaConfig,
  OpenAIConfig,
  DeepSeekConfig,
  GeminiConfig,
  ModelConfig,
} from '../interfaces/model-config.interface';
import { AIError, AIErrorCode } from '../utils/ai-error';

/**
 * Provider availability status
 */
export interface ProviderStatus {
  name: string;
  isAvailable: boolean;
  lastHealthCheck: Date;
  error?: string;
}

/**
 * AI Provider Factory
 * Responsible for creating and managing AI provider instances
 * Validates: Requirements 1.6, 1.7, 3.3, 3.4
 */
@Injectable()
export class AIProviderFactory implements OnModuleInit {
  private readonly logger = new Logger(AIProviderFactory.name);
  private providers: Map<string, AIProvider> = new Map();
  private providerStatus: Map<string, ProviderStatus> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly healthCheckIntervalMs: number = 60000; // 1 minute

  constructor(private modelConfigService: ModelConfigService) {}

  /**
   * Initialize factory on module startup
   * Validates: Requirements 1.6
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing AI Provider Factory');

    try {
      // Load all configured providers
      await this.loadAllProviders();

      // Perform initial health checks
      await this.performHealthChecks();

      // Start periodic health checks
      this.startHealthCheckInterval();

      this.logger.log(
        `AI Provider Factory initialized with ${this.providers.size} providers`
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize AI Provider Factory: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Load all configured providers
   * Validates: Requirements 1.6
   */
  private async loadAllProviders(): Promise<void> {
    const allConfigs = await this.modelConfigService.getAllModelConfigs();

    // Group configs by provider
    const providerGroups = new Map<string, ModelConfig[]>();
    for (const config of allConfigs) {
      if (!config.isActive) continue;

      const existing = providerGroups.get(config.provider) || [];
      existing.push(config);
      providerGroups.set(config.provider, existing);
    }

    const configuredProviders = Array.from(providerGroups.keys());

    this.logger.log(
      `Loading ${configuredProviders.length} configured providers: ${configuredProviders.join(', ')}`
    );

    for (const providerName of configuredProviders) {
      try {
        const provider = await this.createProvider(
          providerName,
          providerGroups.get(providerName)?.[0]
        );

        if (provider) {
          this.providers.set(providerName, provider);
          this.providerStatus.set(providerName, {
            name: providerName,
            isAvailable: false, // Will be set by health check
            lastHealthCheck: new Date(),
          });

          this.logger.log(`Loaded provider: ${providerName}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to load provider ${providerName}: ${error instanceof Error ? error.message : String(error)}`
        );

        this.providerStatus.set(providerName, {
          name: providerName,
          isAvailable: false,
          lastHealthCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Create a provider instance based on configuration
   * Validates: Requirements 1.6, 3.3
   */
  private async createProvider(
    providerName: string,
    modelConfig?: ModelConfig
  ): Promise<AIProvider | null> {
    if (!modelConfig) {
      const configs =
        await this.modelConfigService.getConfigsByProvider(providerName);
      modelConfig = configs.find((c) => c.isActive);
    }

    if (!modelConfig) {
      this.logger.warn(
        `Provider ${providerName} is not configured or inactive`
      );
      return null;
    }

    // Convert ModelConfig to specific provider config
    // Note: ModelConfig doesn't have all fields like 'organization' or 'timeout',
    // so we use defaults or undefined.
    const baseConfig = {
      apiKey: modelConfig.apiKey,
      endpoint: modelConfig.endpoint,
      defaultTemperature: modelConfig.defaultTemperature,
      defaultMaxTokens: modelConfig.defaultMaxTokens,
      timeout: 30000, // Default timeout
      isActive: modelConfig.isActive,
    };

    switch (providerName) {
      case 'qwen':
        return new QwenProvider(baseConfig as QwenConfig);

      case 'ollama':
        return new OllamaProvider({
          ...baseConfig,
          baseUrl: modelConfig.endpoint, // Map endpoint to baseUrl for Ollama
        } as OllamaConfig);

      case 'openai':
        return new OpenAIProvider(baseConfig as OpenAIConfig);

      case 'deepseek':
        return new DeepSeekProvider(baseConfig as DeepSeekConfig);

      case 'gemini':
        return new GeminiProvider(baseConfig as GeminiConfig);

      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Perform health checks on all providers
   * Validates: Requirements 3.3, 3.4
   */
  private async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing health checks on all providers');

    const healthCheckPromises = Array.from(this.providers.entries()).map(
      async ([providerName, provider]) => {
        try {
          const isHealthy = await provider.healthCheck();

          const status = this.providerStatus.get(providerName);
          if (status) {
            status.isAvailable = isHealthy;
            status.lastHealthCheck = new Date();
            if (!isHealthy) {
              status.error = 'Health check failed';
            } else {
              delete status.error;
            }
          }

          if (isHealthy) {
            this.logger.log(`Provider ${providerName} is healthy`);
          } else {
            this.logger.warn(`Provider ${providerName} health check failed`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this.logger.warn(
            `Health check failed for provider ${providerName}: ${errorMessage}. Provider will be unavailable.`
          );

          const status = this.providerStatus.get(providerName);
          if (status) {
            status.isAvailable = false;
            status.lastHealthCheck = new Date();
            status.error = errorMessage;
          }
        }
      }
    );

    await Promise.all(healthCheckPromises);
  }

  /**
   * Start periodic health check interval
   * Validates: Requirements 3.3
   */
  private startHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      this.logger.debug('Running periodic health checks');
      await this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    this.logger.log(
      `Started periodic health checks every ${this.healthCheckIntervalMs}ms`
    );
  }

  /**
   * Get a provider by name
   */
  getProvider(providerName: string): AIProvider {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new AIError(
        AIErrorCode.PROVIDER_UNAVAILABLE,
        `Provider ${providerName} not found or not initialized`,
        undefined,
        false,
        providerName
      );
    }

    const status = this.providerStatus.get(providerName);
    if (status && !status.isAvailable) {
      throw new AIError(
        AIErrorCode.PROVIDER_UNAVAILABLE,
        `Provider ${providerName} is not available: ${status.error || 'Unknown error'}`,
        undefined,
        true,
        providerName
      );
    }

    return provider;
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): AIProvider[] {
    const availableProviders: AIProvider[] = [];

    for (const [providerName, provider] of this.providers.entries()) {
      const status = this.providerStatus.get(providerName);
      if (status && status.isAvailable) {
        availableProviders.push(provider);
      }
    }

    return availableProviders;
  }

  /**
   * Get provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get available provider names
   */
  getAvailableProviderNames(): string[] {
    const availableNames: string[] = [];

    for (const [providerName, status] of this.providerStatus.entries()) {
      if (status.isAvailable) {
        availableNames.push(providerName);
      }
    }

    return availableNames;
  }

  /**
   * Get provider status
   */
  getProviderStatus(providerName: string): ProviderStatus | undefined {
    return this.providerStatus.get(providerName);
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): ProviderStatus[] {
    return Array.from(this.providerStatus.values());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(providerName: string): boolean {
    const status = this.providerStatus.get(providerName);
    return status ? status.isAvailable : false;
  }

  /**
   * Manually trigger health check for a specific provider
   * Validates: Requirements 3.3
   */
  async checkProviderHealth(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new AIError(
        AIErrorCode.PROVIDER_UNAVAILABLE,
        `Provider ${providerName} not found`,
        undefined,
        false,
        providerName
      );
    }

    try {
      const isHealthy = await provider.healthCheck();

      const status = this.providerStatus.get(providerName);
      if (status) {
        status.isAvailable = isHealthy;
        status.lastHealthCheck = new Date();
        if (!isHealthy) {
          status.error = 'Health check failed';
        } else {
          delete status.error;
        }
      }

      return isHealthy;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const status = this.providerStatus.get(providerName);
      if (status) {
        status.isAvailable = false;
        status.lastHealthCheck = new Date();
        status.error = errorMessage;
      }

      throw new AIError(
        AIErrorCode.PROVIDER_UNAVAILABLE,
        `Health check failed for provider ${providerName}: ${errorMessage}`,
        error instanceof Error ? error : undefined,
        false,
        providerName
      );
    }
  }

  /**
   * Reload provider configuration
   * Validates: Requirements 1.7
   */
  async reloadProviders(): Promise<void> {
    this.logger.log('Reloading provider configurations');

    // Clear existing providers
    this.providers.clear();
    this.providerStatus.clear();

    // Reload all providers
    await this.loadAllProviders();

    // Perform health checks
    await this.performHealthChecks();

    this.logger.log('Provider configurations reloaded');
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.logger.log('Stopped periodic health checks');
    }
  }
}
