/**
 * Model Configuration Service
 * Manages model configurations from environment variables, YAML files, and database
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { YamlConfigLoader } from './yaml-config.loader';
import { ModelConfig as PrismaModelConfig } from '@prisma/client';
import * as crypto from 'crypto';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  endpoint?: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ModelConfigService implements OnModuleInit {
  private readonly logger = new Logger(ModelConfigService.name);
  private configCache: Map<string, ModelConfig> = new Map();
  private encryptionKey: string;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private yamlLoader: YamlConfigLoader
  ) {
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      'default-encryption-key-change-in-production';
  }

  async onModuleInit(): Promise<void> {
    await this.loadConfigurations();
  }

  /**
   * Load configurations from database
   * All configurations are now stored in database for dynamic management
   */
  private async loadConfigurations(): Promise<void> {
    this.logger.log('Loading model configurations from database...');

    try {
      await this.loadFromDatabase();
      this.logger.log(`Loaded ${this.configCache.size} model configurations`);
    } catch (error) {
      this.logger.error(
        `Failed to load configurations: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load configurations from database
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      const configs = await this.prisma.modelConfig.findMany({
        where: { isActive: true },
      });

      for (const config of configs) {
        const decryptedConfig = this.decryptConfig(config);
        this.configCache.set(config.name, decryptedConfig);
        this.cacheTimestamps.set(config.name, Date.now());
      }

      this.logger.log(`Loaded ${configs.length} configurations from database`);
    } catch (error) {
      this.logger.warn(
        `Failed to load configurations from database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get model configuration by name
   */
  async getModelConfig(name: string): Promise<ModelConfig | null> {
    // Check cache first
    const cached = this.configCache.get(name);
    if (cached && this.isCacheValid(name)) {
      return cached;
    }

    // Load from database
    try {
      const config = await this.prisma.modelConfig.findUnique({
        where: { name },
      });

      if (config) {
        const decrypted = this.decryptConfig(config);
        this.configCache.set(name, decrypted);
        this.cacheTimestamps.set(name, Date.now());
        return decrypted;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get model config: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return null;
  }

  /**
   * Get all model configurations
   */
  async getAllModelConfigs(): Promise<ModelConfig[]> {
    return Array.from(this.configCache.values());
  }

  /**
   * Get configurations by provider
   */
  async getConfigsByProvider(provider: string): Promise<ModelConfig[]> {
    return Array.from(this.configCache.values()).filter(
      (config) => config.provider === provider
    );
  }

  /**
   * Create or update model configuration
   */
  async upsertModelConfig(config: ModelConfig): Promise<ModelConfig> {
    try {
      // Validate configuration
      this.validateModelConfig(config);

      // Encrypt API key before storing
      const encryptedConfig = this.encryptConfig(config);

      const result = await this.prisma.modelConfig.upsert({
        where: { name: config.name },
        update: {
          provider: config.provider,
          apiKey: encryptedConfig.apiKey,
          endpoint: config.endpoint,
          defaultTemperature: config.defaultTemperature,
          defaultMaxTokens: config.defaultMaxTokens,
          costPerInputToken: config.costPerInputToken,
          costPerOutputToken: config.costPerOutputToken,
          rateLimitPerMinute: config.rateLimitPerMinute,
          rateLimitPerDay: config.rateLimitPerDay,
          isActive: config.isActive,
          updatedAt: new Date(),
        },
        create: {
          name: config.name,
          provider: config.provider,
          apiKey: encryptedConfig.apiKey,
          endpoint: config.endpoint,
          defaultTemperature: config.defaultTemperature,
          defaultMaxTokens: config.defaultMaxTokens,
          costPerInputToken: config.costPerInputToken,
          costPerOutputToken: config.costPerOutputToken,
          rateLimitPerMinute: config.rateLimitPerMinute,
          rateLimitPerDay: config.rateLimitPerDay,
          isActive: config.isActive,
        },
      });

      const decrypted = this.decryptConfig(result);
      this.configCache.set(config.name, decrypted);
      this.cacheTimestamps.set(config.name, Date.now());

      this.logger.log(`Upserted model configuration: ${config.name}`);
      return decrypted;
    } catch (error) {
      this.logger.error(
        `Failed to upsert model config: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Delete model configuration
   */
  async deleteModelConfig(name: string): Promise<void> {
    try {
      await this.prisma.modelConfig.delete({
        where: { name },
      });

      this.configCache.delete(name);
      this.cacheTimestamps.delete(name);

      this.logger.log(`Deleted model configuration: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete model config: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Disable model configuration
   */
  async disableModelConfig(name: string): Promise<void> {
    try {
      await this.prisma.modelConfig.update({
        where: { name },
        data: { isActive: false },
      });

      const config = this.configCache.get(name);
      if (config) {
        config.isActive = false;
      }

      this.logger.log(`Disabled model configuration: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to disable model config: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Enable model configuration
   */
  async enableModelConfig(name: string): Promise<void> {
    try {
      await this.prisma.modelConfig.update({
        where: { name },
        data: { isActive: true },
      });

      const config = this.configCache.get(name);
      if (config) {
        config.isActive = true;
      }

      this.logger.log(`Enabled model configuration: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to enable model config: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Refresh configuration cache
   */
  async refreshCache(): Promise<void> {
    this.logger.log('Refreshing configuration cache...');
    this.configCache.clear();
    this.cacheTimestamps.clear();
    await this.loadConfigurations();
  }

  /**
   * Validate model configuration
   */
  private validateModelConfig(config: ModelConfig): void {
    if (!config.name || !config.name.trim()) {
      throw new Error('Model name is required');
    }

    if (!config.provider || !config.provider.trim()) {
      throw new Error('Provider is required');
    }

    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API key is required');
    }

    if (config.defaultTemperature < 0 || config.defaultTemperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }

    if (config.defaultMaxTokens < 1) {
      throw new Error('Max tokens must be at least 1');
    }

    if (config.costPerInputToken < 0 || config.costPerOutputToken < 0) {
      throw new Error('Cost parameters must be non-negative');
    }

    if (config.rateLimitPerMinute < 0 || config.rateLimitPerDay < 0) {
      throw new Error('Rate limit parameters must be non-negative');
    }
  }

  /**
   * Encrypt API key
   */
  private encryptConfig(config: ModelConfig): ModelConfig {
    const encrypted = { ...config };
    encrypted.apiKey = this.encrypt(config.apiKey);
    return encrypted;
  }

  /**
   * Decrypt API key
   */
  private decryptConfig(config: PrismaModelConfig): ModelConfig {
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: this.decrypt(config.apiKey),
      endpoint: config.endpoint || undefined,
      defaultTemperature: config.defaultTemperature,
      defaultMaxTokens: config.defaultMaxTokens,
      costPerInputToken: config.costPerInputToken,
      costPerOutputToken: config.costPerOutputToken,
      rateLimitPerMinute: config.rateLimitPerMinute,
      rateLimitPerDay: config.rateLimitPerDay,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Encrypt string using AES-256-GCM
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
      iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt string using AES-256-GCM
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(name: string): boolean {
    const timestamp = this.cacheTimestamps.get(name);
    if (!timestamp) {
      return false;
    }

    return Date.now() - timestamp < this.CACHE_TTL;
  }
}
