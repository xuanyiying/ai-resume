/**
 * JSON Output Helper Tests
 * Property 24: JSON Output Constraint
 * Validates: Requirements 6.3, 6.4
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JSONOutputHelper, JSONSchema } from './json-output.helper';
import { AIEngineService } from '../../ai-providers/ai-engine.service';

describe('JSONOutputHelper', () => {
  let service: JSONOutputHelper;
  let mockAIEngineService: jest.Mocked<AIEngineService>;

  beforeEach(async () => {
    mockAIEngineService = {
      call: jest.fn(),
    } as unknown as jest.Mocked<AIEngineService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JSONOutputHelper,
        {
          provide: AIEngineService,
          useValue: mockAIEngineService,
        },
      ],
    }).compile();

    service = module.get<JSONOutputHelper>(JSONOutputHelper);
  });

  describe('callWithJSONOutput', () => {
    it('should parse valid JSON response', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const mockResponse = {
        content: '{"name": "John", "age": 30}',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockAIEngineService.call.mockResolvedValue(mockResponse as any);

      const result = await service.callWithJSONOutput({
        prompt: 'Generate a person',
        schema,
        userId: 'test-user',
      });

      expect(result.data).toEqual({ name: 'John', age: 30 });
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
    });

    it('should handle JSON in markdown code blocks', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      };

      const mockResponse = {
        content: '```json\n{"result": "success"}\n```',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockAIEngineService.call.mockResolvedValue(mockResponse as any);

      const result = await service.callWithJSONOutput({
        prompt: 'Generate result',
        schema,
        userId: 'test-user',
      });

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should validate required fields', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const mockResponse = {
        content: '{"name": "John"}',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockAIEngineService.call.mockResolvedValue(mockResponse as any);

      await expect(
        service.callWithJSONOutput({
          prompt: 'Generate person',
          schema,
          userId: 'test-user',
        })
      ).rejects.toThrow('Missing required field: email');
    });

    it('should validate field types', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          age: { type: 'number' },
        },
      };

      const mockResponse = {
        content: '{"age": "thirty"}',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockAIEngineService.call.mockResolvedValue(mockResponse as any);

      await expect(
        service.callWithJSONOutput({
          prompt: 'Generate person',
          schema,
          userId: 'test-user',
        })
      ).rejects.toThrow('Expected number');
    });

    it('should handle array schemas', async () => {
      const schema: JSONSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      };

      const mockResponse = {
        content: '[{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockAIEngineService.call.mockResolvedValue(mockResponse as any);

      const result = await service.callWithJSONOutput({
        prompt: 'Generate items',
        schema,
        userId: 'test-user',
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data as any[]).length).toBe(2);
    });

    it('should use lower temperature for structured output', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      };

      const mockResponse = {
        content: '{"result": "success"}',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockAIEngineService.call.mockResolvedValue(mockResponse as any);

      await service.callWithJSONOutput({
        prompt: 'Generate result',
        schema,
        userId: 'test-user',
      });

      expect(mockAIEngineService.call).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        }),
        'test-user',
        'json-output'
      );
    });
  });

  describe('Schema helpers', () => {
    it('should create object schema', () => {
      const schema = JSONOutputHelper.createObjectSchema(
        {
          name: JSONOutputHelper.createStringSchema('User name'),
          age: JSONOutputHelper.createNumberSchema('User age'),
        },
        ['name']
      );

      expect(schema.type).toBe('object');
      expect(schema.required).toContain('name');
    });

    it('should create array schema', () => {
      const schema = JSONOutputHelper.createArraySchema(
        JSONOutputHelper.createStringSchema()
      );

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
    });

    it('should create string schema', () => {
      const schema = JSONOutputHelper.createStringSchema('A string value');

      expect(schema.type).toBe('string');
      expect(schema.description).toBe('A string value');
    });

    it('should create number schema', () => {
      const schema = JSONOutputHelper.createNumberSchema('A number value');

      expect(schema.type).toBe('number');
      expect(schema.description).toBe('A number value');
    });

    it('should create boolean schema', () => {
      const schema = JSONOutputHelper.createBooleanSchema('A boolean value');

      expect(schema.type).toBe('boolean');
      expect(schema.description).toBe('A boolean value');
    });
  });
});
