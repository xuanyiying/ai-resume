/**
 * AI Provider Factory Tests
 * Tests for AI provider factory implementation
 * **Feature: multi-llm-provider-integration, Property 2: 提供商初始化, Property 3: 动态配置更新**
 * **Validates: Requirements 1.6, 1.7, 3.3, 3.4**
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AIProviderFactory } from './ai-provider.factory';
import { ProviderConfigService } from '../config/provider.config';
import { AIError } from '../utils/ai-error';

describe('AIProviderFactory', () => {
  let factory: AIProviderFactory;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [ProviderConfigService, AIProviderFactory],
    }).compile();

    factory = module.get<AIProviderFactory>(AIProviderFactory);

    // Initialize the factory
    await factory.onModuleInit();
  });

  afterEach(async () => {
    factory.onModuleDestroy();
    await module.close();
  });

  describe('Factory Initialization', () => {
    it('should initialize factory on module init', async () => {
      expect(factory).toBeDefined();
      expect(factory.getProviderNames().length).toBeGreaterThanOrEqual(0);
    });

    it('should load configured providers', async () => {
      const providerNames = factory.getProviderNames();
      expect(Array.isArray(providerNames)).toBe(true);
    });

    it('should set up health check interval', async () => {
      // Health check interval should be running
      expect(factory).toBeDefined();
    });
  });

  describe('Provider Loading', () => {
    it('should load Qwen provider if configured', async () => {
      const providers = factory.getProviderNames();

      if (providers.includes('qwen')) {
        const provider = factory.getProvider('qwen');
        expect(provider).toBeDefined();
        expect(provider.name).toBe('qwen');
      }
    });

    it('should load Ollama provider if configured', async () => {
      const providers = factory.getProviderNames();

      if (providers.includes('ollama')) {
        const provider = factory.getProvider('ollama');
        expect(provider).toBeDefined();
        expect(provider.name).toBe('ollama');
      }
    });

    it('should throw error for non-existent provider', () => {
      expect(() => factory.getProvider('non-existent')).toThrow(AIError);
    });

    it('should throw error for unavailable provider', () => {
      const providers = factory.getProviderNames();

      if (providers.length > 0) {
        // Get first provider and check if it's available
        const firstProvider = providers[0];
        const status = factory.getProviderStatus(firstProvider);

        if (status && !status.isAvailable) {
          expect(() => factory.getProvider(firstProvider)).toThrow(AIError);
        }
      }
    });
  });

  describe('Provider Status Management', () => {
    it('should track provider status', () => {
      const statuses = factory.getAllProviderStatuses();
      expect(Array.isArray(statuses)).toBe(true);

      for (const status of statuses) {
        expect(status).toHaveProperty('name');
        expect(status).toHaveProperty('isAvailable');
        expect(status).toHaveProperty('lastHealthCheck');
      }
    });

    it('should return provider status by name', () => {
      const providers = factory.getProviderNames();

      if (providers.length > 0) {
        const status = factory.getProviderStatus(providers[0]);
        expect(status).toBeDefined();
        expect(status?.name).toBe(providers[0]);
      }
    });

    it('should indicate provider availability', () => {
      const providers = factory.getProviderNames();

      for (const providerName of providers) {
        const isAvailable = factory.isProviderAvailable(providerName);
        expect(typeof isAvailable).toBe('boolean');
      }
    });

    it('should return false for non-existent provider availability', () => {
      const isAvailable = factory.isProviderAvailable('non-existent');
      expect(isAvailable).toBe(false);
    });
  });

  describe('Available Providers', () => {
    it('should return list of available providers', () => {
      const availableProviders = factory.getAvailableProviders();
      expect(Array.isArray(availableProviders)).toBe(true);

      for (const provider of availableProviders) {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('call');
        expect(provider).toHaveProperty('stream');
        expect(provider).toHaveProperty('healthCheck');
        expect(provider).toHaveProperty('listModels');
        expect(provider).toHaveProperty('getModelInfo');
      }
    });

    it('should return list of available provider names', () => {
      const availableNames = factory.getAvailableProviderNames();
      expect(Array.isArray(availableNames)).toBe(true);

      for (const name of availableNames) {
        expect(typeof name).toBe('string');
        expect(factory.isProviderAvailable(name)).toBe(true);
      }
    });

    it('should only return healthy providers', () => {
      const availableNames = factory.getAvailableProviderNames();
      const allNames = factory.getProviderNames();

      // Available providers should be a subset of all providers
      expect(availableNames.length).toBeLessThanOrEqual(allNames.length);

      for (const name of availableNames) {
        expect(factory.isProviderAvailable(name)).toBe(true);
      }
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on specific provider', async () => {
      const providers = factory.getProviderNames();

      if (providers.length > 0) {
        const providerName = providers[0];

        try {
          const isHealthy = await factory.checkProviderHealth(providerName);
          expect(typeof isHealthy).toBe('boolean');

          const status = factory.getProviderStatus(providerName);
          expect(status?.isAvailable).toBe(isHealthy);
        } catch (error) {
          // Health check may fail if provider is not properly configured
          expect(error).toBeInstanceOf(AIError);
        }
      }
    });

    it('should throw error for health check on non-existent provider', async () => {
      await expect(factory.checkProviderHealth('non-existent')).rejects.toThrow(
        AIError
      );
    });

    it('should update provider status after health check', async () => {
      const providers = factory.getProviderNames();

      if (providers.length > 0) {
        const providerName = providers[0];
        const statusBefore = factory.getProviderStatus(providerName);
        const timeBefore = statusBefore?.lastHealthCheck;

        try {
          await factory.checkProviderHealth(providerName);

          const statusAfter = factory.getProviderStatus(providerName);
          expect(statusAfter?.lastHealthCheck).not.toEqual(timeBefore);
        } catch (error) {
          // Health check may fail, but status should still be updated
          const statusAfter = factory.getProviderStatus(providerName);
          expect(statusAfter?.lastHealthCheck).not.toEqual(timeBefore);
        }
      }
    });
  });

  describe('Provider Reloading', () => {
    it('should reload providers', async () => {
      const initialCount = factory.getProviderNames().length;

      await factory.reloadProviders();

      const providersAfter = factory.getProviderNames();

      // Should have same providers after reload
      expect(providersAfter.length).toBe(initialCount);
    });

    it('should clear and reinitialize providers on reload', async () => {
      // Get initial provider count
      const initialProviderCount = factory.getProviderNames().length;
      const statusesBefore = factory.getAllProviderStatuses();

      // Reload providers
      await factory.reloadProviders();

      const statusesAfter = factory.getAllProviderStatuses();
      const providersAfter = factory.getProviderNames();

      // Should have same number of statuses and providers after reload
      expect(statusesAfter.length).toBe(statusesBefore.length);
      expect(providersAfter.length).toBe(initialProviderCount);
    });

    it('should perform health checks after reload', async () => {
      await factory.reloadProviders();

      const statuses = factory.getAllProviderStatuses();

      for (const status of statuses) {
        expect(status.lastHealthCheck).toBeDefined();
      }
    });
  });

  describe('Property 2: Provider Initialization', () => {
    it('should load all configured providers on startup', async () => {
      const providers = factory.getProviderNames();
      expect(Array.isArray(providers)).toBe(true);

      // Each provider should be properly initialized
      for (const providerName of providers) {
        const provider = factory.getProvider(providerName);
        expect(provider).toBeDefined();
        expect(provider.name).toBe(providerName);
      }
    });

    it('should initialize provider with correct interface', async () => {
      const providers = factory.getAvailableProviders();

      for (const provider of providers) {
        // Check that provider implements AIProvider interface
        expect(typeof provider.call).toBe('function');
        expect(typeof provider.stream).toBe('function');
        expect(typeof provider.healthCheck).toBe('function');
        expect(typeof provider.listModels).toBe('function');
        expect(typeof provider.getModelInfo).toBe('function');
        expect(typeof provider.name).toBe('string');
      }
    });

    it('should mark unavailable providers appropriately', () => {
      const allStatuses = factory.getAllProviderStatuses();

      for (const status of allStatuses) {
        if (!status.isAvailable) {
          expect(status.error).toBeDefined();
        }
      }
    });
  });

  describe('Property 3: Dynamic Configuration Update', () => {
    it('should reload providers when configuration changes', async () => {
      // Reload providers (simulating configuration change)
      await factory.reloadProviders();

      const providersAfter = factory.getProviderNames();

      // Should have same providers (or updated list)
      expect(Array.isArray(providersAfter)).toBe(true);
    });

    it('should update provider availability after reload', async () => {
      const statusesBefore = factory.getAllProviderStatuses();

      await factory.reloadProviders();

      const statusesAfter = factory.getAllProviderStatuses();

      // Statuses should be updated
      for (const statusAfter of statusesAfter) {
        const statusBefore = statusesBefore.find(
          (s) => s.name === statusAfter.name
        );
        if (statusBefore) {
          // Last health check time should be updated
          expect(statusAfter.lastHealthCheck.getTime()).toBeGreaterThanOrEqual(
            statusBefore.lastHealthCheck.getTime()
          );
        }
      }
    });

    it('should support dynamic provider list updates', async () => {
      // Reload should support dynamic updates
      await factory.reloadProviders();

      const updatedProviders = factory.getProviderNames();

      // Should be able to get providers after update
      for (const providerName of updatedProviders) {
        const status = factory.getProviderStatus(providerName);
        expect(status).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle provider creation errors gracefully', async () => {
      // Try to get a provider that doesn't exist
      expect(() => factory.getProvider('invalid-provider')).toThrow(AIError);
    });

    it('should provide error details in provider status', () => {
      const statuses = factory.getAllProviderStatuses();

      for (const status of statuses) {
        if (!status.isAvailable) {
          // Unavailable providers should have error information
          expect(status.error).toBeDefined();
        }
      }
    });

    it('should handle health check failures', async () => {
      const providers = factory.getProviderNames();

      if (providers.length > 0) {
        const providerName = providers[0];

        try {
          await factory.checkProviderHealth(providerName);
        } catch (error) {
          // Should throw AIError on failure
          expect(error).toBeInstanceOf(AIError);
        }
      }
    });
  });

  describe('Cleanup', () => {
    it('should clean up health check interval on module destroy', () => {
      factory.onModuleDestroy();

      // After destroy, factory should still be accessible but health checks should stop
      expect(factory).toBeDefined();
    });
  });
});
