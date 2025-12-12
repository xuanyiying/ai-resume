/**
 * JSON Output Helper
 * Provides utilities for structured JSON output from LLM calls
 * Requirements: 6.3, 6.4
 */

import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { AIRequest } from '../../ai-providers/interfaces';

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
}

export interface StructuredOutputRequest {
  prompt: string;
  schema: JSONSchema;
  userId: string;
  scenario?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredOutputResponse<T = unknown> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  raw: string;
}

@Injectable()
export class JSONOutputHelper {
  private readonly logger = new Logger(JSONOutputHelper.name);

  constructor(private aiEngineService: AIEngineService) {}

  /**
   * Call LLM with JSON output constraint
   * Property 24: JSON Output Constraint
   * Validates: Requirements 6.3, 6.4
   */
  async callWithJSONOutput<T = unknown>(
    request: StructuredOutputRequest
  ): Promise<StructuredOutputResponse<T>> {
    try {
      // Build schema description for the prompt
      const schemaDescription = this.buildSchemaDescription(request.schema);

      // Create constrained prompt
      const constrainedPrompt = `${request.prompt}

IMPORTANT: You MUST respond with ONLY valid JSON that matches this schema:
${schemaDescription}

Do not include any explanation, markdown formatting, or text outside the JSON.
Respond with the JSON object directly.`;

      // Call LLM with constraints
      const response = await this.aiEngineService.call(
        {
          model: '',
          prompt: constrainedPrompt,
          temperature: request.temperature ?? 0.3, // Lower temperature for structured output
          maxTokens: request.maxTokens ?? 2000,
          metadata: {
            outputFormat: 'json',
            schema: request.schema,
          },
        } as AIRequest,
        request.userId,
        request.scenario ?? 'json-output'
      );

      // Parse and validate JSON
      const parsed = this.parseAndValidateJSON<T>(
        response.content,
        request.schema
      );

      this.logger.debug(
        `Generated structured JSON output: ${response.usage.outputTokens} tokens`
      );

      return {
        data: parsed,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        raw: response.content,
      };
    } catch (error) {
      this.logger.error(
        `Failed to call with JSON output: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Build human-readable schema description
   */
  private buildSchemaDescription(schema: JSONSchema): string {
    if (schema.type === 'object' && schema.properties) {
      const properties = Object.entries(schema.properties)
        .map(([key, prop]) => {
          const required = schema.required?.includes(key) ? ' (required)' : '';
          const description = prop.description ? ` - ${prop.description}` : '';
          return `  "${key}": ${prop.type}${required}${description}`;
        })
        .join('\n');

      return `{\n${properties}\n}`;
    }

    if (schema.type === 'array' && schema.items) {
      return `[${this.buildSchemaDescription(schema.items)}]`;
    }

    return schema.type;
  }

  /**
   * Parse and validate JSON response
   */
  private parseAndValidateJSON<T = unknown>(
    content: string,
    schema: JSONSchema
  ): T {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      // Parse JSON
      const parsed = JSON.parse(jsonStr) as T;

      // Validate against schema
      this.validateAgainstSchema(parsed, schema);

      return parsed;
    } catch (error) {
      this.logger.error(
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new Error(
        `Invalid JSON output from LLM: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate parsed object against schema
   */
  private validateAgainstSchema(data: unknown, schema: JSONSchema): void {
    if (schema.type === 'object' && schema.properties) {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error(`Expected object, got ${typeof data}`);
      }

      const obj = data as Record<string, unknown>;

      // Check required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in obj)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }

      // Validate each property
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in obj) {
          this.validateAgainstSchema(obj[key], prop);
        }
      }
    } else if (schema.type === 'array' && schema.items) {
      if (!Array.isArray(data)) {
        throw new Error(`Expected array, got ${typeof data}`);
      }

      for (const item of data) {
        this.validateAgainstSchema(item, schema.items);
      }
    } else if (schema.type === 'string' && typeof data !== 'string') {
      throw new Error(`Expected string, got ${typeof data}`);
    } else if (schema.type === 'number' && typeof data !== 'number') {
      throw new Error(`Expected number, got ${typeof data}`);
    } else if (schema.type === 'boolean' && typeof data !== 'boolean') {
      throw new Error(`Expected boolean, got ${typeof data}`);
    }
  }

  /**
   * Create a schema for common structures
   */
  static createObjectSchema(
    properties: Record<string, JSONSchema>,
    required?: string[]
  ): JSONSchema {
    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Create an array schema
   */
  static createArraySchema(itemSchema: JSONSchema): JSONSchema {
    return {
      type: 'array',
      items: itemSchema,
    };
  }

  /**
   * Create a string schema
   */
  static createStringSchema(description?: string): JSONSchema {
    return {
      type: 'string',
      description,
    };
  }

  /**
   * Create a number schema
   */
  static createNumberSchema(description?: string): JSONSchema {
    return {
      type: 'number',
      description,
    };
  }

  /**
   * Create a boolean schema
   */
  static createBooleanSchema(description?: string): JSONSchema {
    return {
      type: 'boolean',
      description,
    };
  }
}
