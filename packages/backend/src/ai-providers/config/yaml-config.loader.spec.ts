/**
 * YAML Configuration Loader Tests
 * Tests for YAML configuration loading
 * Requirements: 3.2
 */

import { Test, TestingModule } from '@nestjs/testing';
import { YamlConfigLoader } from './yaml-config.loader';
import * as fc from 'fast-check';

describe('YamlConfigLoader', () => {
  let loader: YamlConfigLoader;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YamlConfigLoader],
    }).compile();

    loader = module.get<YamlConfigLoader>(YamlConfigLoader);
  });

  describe('YAML File Loading', () => {
    it('should return null for non-existent file', () => {
      const result = loader.loadFromFile('/non/existent/path.yaml');
      expect(result).toBeNull();
    });

    it('should validate YAML configuration structure', () => {
      const validConfig = {
        providers: {
          openai: {
            apiKey: 'test-key',
          },
        },
      };

      const isValid = loader.validateConfig(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject configuration without providers section', () => {
      const invalidConfig = {};
      const isValid = loader.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should reject null configuration', () => {
      const isValid = loader.validateConfig(null as any);
      expect(isValid).toBe(false);
    });
  });

  describe('Configuration Conversion', () => {
    it('should convert YAML config to ProviderConfigMap', () => {
      const yamlConfig = {
        providers: {
          openai: {
            apiKey: 'test-openai-key',
            endpoint: 'https://api.openai.com/v1',
            defaultTemperature: 0.8,
            defaultMaxTokens: 3000,
          },
          qwen: {
            apiKey: 'test-qwen-key',
            defaultTemperature: 0.6,
          },
        },
      };

      const result = loader.convertToProviderConfigMap(yamlConfig);

      expect(result.openai).toBeDefined();
      expect(result.openai?.apiKey).toBe('test-openai-key');
      expect(result.openai?.endpoint).toBe('https://api.openai.com/v1');
      expect(result.openai?.defaultTemperature).toBe(0.8);
      expect(result.openai?.defaultMaxTokens).toBe(3000);

      expect(result.qwen).toBeDefined();
      expect(result.qwen?.apiKey).toBe('test-qwen-key');
      expect(result.qwen?.defaultTemperature).toBe(0.6);
    });

    it('should apply default values for missing parameters', () => {
      const yamlConfig = {
        providers: {
          openai: {
            apiKey: 'test-key',
          },
        },
      };

      const result = loader.convertToProviderConfigMap(yamlConfig);

      expect(result.openai?.defaultTemperature).toBe(0.7);
      expect(result.openai?.defaultMaxTokens).toBe(2000);
      expect(result.openai?.isActive).toBe(true);
    });

    it('should handle Ollama configuration with baseUrl', () => {
      const yamlConfig = {
        providers: {
          ollama: {
            apiKey: '',
            baseUrl: 'http://custom-ollama:11434',
            defaultTemperature: 0.5,
          },
        },
      };

      const result = loader.convertToProviderConfigMap(yamlConfig);

      expect(result.ollama).toBeDefined();
      expect(result.ollama?.baseUrl).toBe('http://custom-ollama:11434');
      expect(result.ollama?.defaultTemperature).toBe(0.5);
    });

    it('should handle empty providers section', () => {
      const yamlConfig = {
        providers: {},
      };

      const result = loader.convertToProviderConfigMap(yamlConfig);

      expect(Object.keys(result).length).toBe(0);
    });

    it('should handle null providers section', () => {
      const yamlConfig = {
        providers: null,
      } as any;

      const result = loader.convertToProviderConfigMap(yamlConfig);

      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: multi-llm-provider-integration, Property 10: YAML 配置文件支持**
     * **Validates: Requirements 3.2**
     *
     * For any valid provider configuration in YAML format, the loader should
     * be able to convert it to a ProviderConfigMap with correct default values.
     */
    it('should handle various provider configurations', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasApiKey: fc.boolean(),
            temperature: fc.option(fc.float({ min: 0, max: 2 })),
            maxTokens: fc.option(fc.integer({ min: 1, max: 100000 })),
            isActive: fc.option(fc.boolean()),
          }),
          (testData) => {
            const config = {
              providers: {
                openai: testData.hasApiKey
                  ? {
                      apiKey: 'test-key',
                      defaultTemperature: testData.temperature,
                      defaultMaxTokens: testData.maxTokens,
                      isActive: testData.isActive,
                    }
                  : {},
              },
            };

            const result = loader.convertToProviderConfigMap(config);

            if (testData.hasApiKey) {
              expect(result.openai).toBeDefined();
              expect(result.openai?.apiKey).toBe('test-key');
              expect(result.openai?.defaultTemperature).toBe(
                testData.temperature ?? 0.7
              );
              expect(result.openai?.defaultMaxTokens).toBe(
                testData.maxTokens ?? 2000
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: multi-llm-provider-integration, Property 10: YAML 配置文件支持**
     * **Validates: Requirements 3.2**
     *
     * For any provider name, the loader should correctly identify and convert
     * its configuration.
     */
    it('should handle all provider types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('openai', 'qwen', 'deepseek', 'gemini', 'ollama'),
          (provider) => {
            const config = {
              providers: {
                [provider]: {
                  apiKey: 'test-key',
                },
              },
            };

            const result = loader.convertToProviderConfigMap(config);

            expect(result[provider as keyof typeof result]).toBeDefined();
            // Ollama uses empty string for apiKey by default
            if (provider === 'ollama') {
              expect(result[provider as keyof typeof result]?.apiKey).toBe('');
            } else {
              expect(result[provider as keyof typeof result]?.apiKey).toBe(
                'test-key'
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: multi-llm-provider-integration, Property 10: YAML 配置文件支持**
     * **Validates: Requirements 3.2**
     *
     * For any configuration with missing optional fields, the loader should
     * apply appropriate defaults.
     */
    it('should apply defaults for missing optional fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasEndpoint: fc.boolean(),
            hasTemperature: fc.boolean(),
            hasMaxTokens: fc.boolean(),
          }),
          (testData) => {
            const config = {
              providers: {
                openai: {
                  apiKey: 'test-key',
                  ...(testData.hasEndpoint && {
                    endpoint: 'https://api.openai.com/v1',
                  }),
                  ...(testData.hasTemperature && { defaultTemperature: 0.8 }),
                  ...(testData.hasMaxTokens && { defaultMaxTokens: 3000 }),
                },
              },
            };

            const result = loader.convertToProviderConfigMap(config);

            expect(result.openai?.endpoint).toBe(
              testData.hasEndpoint ? 'https://api.openai.com/v1' : undefined
            );
            expect(result.openai?.defaultTemperature).toBe(
              testData.hasTemperature ? 0.8 : 0.7
            );
            expect(result.openai?.defaultMaxTokens).toBe(
              testData.hasMaxTokens ? 3000 : 2000
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
