/**
 * Model Configuration Service Tests (Database-based)
 * Tests for database-driven configuration management
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ModelConfigService } from './model-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { YamlConfigLoader } from './yaml-config.loader';

describe('ModelConfigService (Database)', () => {
  let service: ModelConfigService;
  let prisma: PrismaService;

  const mockPrismaService = {
    modelConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelConfigService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        YamlConfigLoader,
      ],
    }).compile();

    service = module.get<ModelConfigService>(ModelConfigService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadFromDatabase', () => {
    it('should load active configurations from database', async () => {
      const mockConfigs = [
        {
          id: '1',
          name: 'gpt-4o',
          provider: 'openai',
          apiKey: 'encrypted-key',
          endpoint: 'https://api.openai.com/v1',
          defaultTemperature: 0.7,
          defaultMaxTokens: 4096,
          costPerInputToken: 0.000005,
          costPerOutputToken: 0.000015,
          rateLimitPerMinute: 3500,
          rateLimitPerDay: 200000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.modelConfig.findMany.mockResolvedValue(mockConfigs);

      await service.onModuleInit();

      expect(mockPrismaService.modelConfig.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.modelConfig.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('getModelConfig', () => {
    it('should return cached config if available and valid', async () => {
      const mockConfig = {
        id: '1',
        name: 'gpt-4o',
        provider: 'openai',
        apiKey: 'test-key',
        endpoint: 'https://api.openai.com/v1',
        defaultTemperature: 0.7,
        defaultMaxTokens: 4096,
        costPerInputToken: 0.000005,
        costPerOutputToken: 0.000015,
        rateLimitPerMinute: 3500,
        rateLimitPerDay: 200000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First call loads from database
      mockPrismaService.modelConfig.findUnique.mockResolvedValue(mockConfig);
      const result1 = await service.getModelConfig('gpt-4o');

      // Second call should use cache
      const result2 = await service.getModelConfig('gpt-4o');

      expect(result1).toEqual(result2);
      expect(mockPrismaService.modelConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should load from database if not in cache', async () => {
      const mockConfig = {
        id: '1',
        name: 'gpt-4o',
        provider: 'openai',
        apiKey: 'encrypted-key',
        endpoint: 'https://api.openai.com/v1',
        defaultTemperature: 0.7,
        defaultMaxTokens: 4096,
        costPerInputToken: 0.000005,
        costPerOutputToken: 0.000015,
        rateLimitPerMinute: 3500,
        rateLimitPerDay: 200000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.modelConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getModelConfig('gpt-4o');

      expect(result).toBeDefined();
      expect(result?.name).toBe('gpt-4o');
      expect(mockPrismaService.modelConfig.findUnique).toHaveBeenCalledWith({
        where: { name: 'gpt-4o' },
      });
    });

    it('should return null if config not found', async () => {
      mockPrismaService.modelConfig.findUnique.mockResolvedValue(null);

      const result = await service.getModelConfig('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('upsertModelConfig', () => {
    it('should create new config with encrypted API key', async () => {
      const newConfig = {
        id: '',
        name: 'new-model',
        provider: 'openai',
        apiKey: 'plain-text-key',
        endpoint: 'https://api.openai.com/v1',
        defaultTemperature: 0.7,
        defaultMaxTokens: 2000,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        rateLimitPerMinute: 0,
        rateLimitPerDay: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreated = {
        ...newConfig,
        id: '1',
        apiKey: 'encrypted-key',
      };

      mockPrismaService.modelConfig.upsert.mockResolvedValue(mockCreated);

      const result = await service.upsertModelConfig(newConfig);

      expect(result).toBeDefined();
      expect(mockPrismaService.modelConfig.upsert).toHaveBeenCalled();
      
      const upsertCall = mockPrismaService.modelConfig.upsert.mock.calls[0][0];
      expect(upsertCall.where.name).toBe('new-model');
      // API key should be encrypted (not plain text)
      expect(upsertCall.create.apiKey).not.toBe('plain-text-key');
    });

    it('should update existing config', async () => {
      const existingConfig = {
        id: '1',
        name: 'gpt-4o',
        provider: 'openai',
        apiKey: 'updated-key',
        endpoint: 'https://api.openai.com/v1',
        defaultTemperature: 0.8,
        defaultMaxTokens: 4096,
        costPerInputToken: 0.000005,
        costPerOutputToken: 0.000015,
        rateLimitPerMinute: 3500,
        rateLimitPerDay: 200000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.modelConfig.upsert.mockResolvedValue(existingConfig);

      const result = await service.upsertModelConfig(existingConfig);

      expect(result).toBeDefined();
      expect(result.defaultTemperature).toBe(0.8);
    });

    it('should validate config before upserting', async () => {
      const invalidConfig = {
        id: '',
        name: '',
        provider: 'openai',
        apiKey: 'key',
        defaultTemperature: 0.7,
        defaultMaxTokens: 2000,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        rateLimitPerMinute: 0,
        rateLimitPerDay: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(service.upsertModelConfig(invalidConfig)).rejects.toThrow(
        'Model name is required'
      );
    });
  });

  describe('enableModelConfig', () => {
    it('should enable a disabled config', async () => {
      mockPrismaService.modelConfig.update.mockResolvedValue({
        id: '1',
        name: 'gpt-4o',
        isActive: true,
      });

      await service.enableModelConfig('gpt-4o');

      expect(mockPrismaService.modelConfig.update).toHaveBeenCalledWith({
        where: { name: 'gpt-4o' },
        data: { isActive: true },
      });
    });
  });

  describe('disableModelConfig', () => {
    it('should disable an enabled config', async () => {
      mockPrismaService.modelConfig.update.mockResolvedValue({
        id: '1',
        name: 'gpt-4o',
        isActive: false,
      });

      await service.disableModelConfig('gpt-4o');

      expect(mockPrismaService.modelConfig.update).toHaveBeenCalledWith({
        where: { name: 'gpt-4o' },
        data: { isActive: false },
      });
    });
  });

  describe('deleteModelConfig', () => {
    it('should delete a config', async () => {
      mockPrismaService.modelConfig.delete.mockResolvedValue({
        id: '1',
        name: 'gpt-4o',
      });

      await service.deleteModelConfig('gpt-4o');

      expect(mockPrismaService.modelConfig.delete).toHaveBeenCalledWith({
        where: { name: 'gpt-4o' },
      });
    });
  });

  describe('refreshCache', () => {
    it('should clear cache and reload from database', async () => {
      mockPrismaService.modelConfig.findMany.mockResolvedValue([]);

      await service.refreshCache();

      expect(mockPrismaService.modelConfig.findMany).toHaveBeenCalled();
    });
  });

  describe('getConfigsByProvider', () => {
    it('should return all configs for a provider', async () => {
      const mockConfigs = [
        {
          id: '1',
          name: 'gpt-4o',
          provider: 'openai',
          apiKey: 'encrypted-key-1',
          defaultTemperature: 0.7,
          defaultMaxTokens: 4096,
          costPerInputToken: 0.000005,
          costPerOutputToken: 0.000015,
          rateLimitPerMinute: 3500,
          rateLimitPerDay: 200000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'gpt-4o-mini',
          provider: 'openai',
          apiKey: 'encrypted-key-2',
          defaultTemperature: 0.7,
          defaultMaxTokens: 4096,
          costPerInputToken: 0.00015,
          costPerOutputToken: 0.0006,
          rateLimitPerMinute: 3500,
          rateLimitPerDay: 200000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.modelConfig.findMany.mockResolvedValue(mockConfigs);
      await service.onModuleInit();

      const result = await service.getConfigsByProvider('openai');

      expect(result).toHaveLength(2);
      expect(result.every((c) => c.provider === 'openai')).toBe(true);
    });
  });
});
