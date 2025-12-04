/**
 * Seed Model Configurations
 * This script seeds the database with default model configurations
 * Run with: npx ts-node prisma/migrations/seed-model-configs.ts
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Encryption key from environment or default
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

/**
 * Encrypt API key using AES-256-GCM
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Default model configurations
 * Replace API keys with your actual keys
 */
const defaultConfigs = [
  {
    name: 'gpt-4o',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
    endpoint: 'https://api.openai.com/v1',
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
    costPerInputToken: 0.005 / 1000,
    costPerOutputToken: 0.015 / 1000,
    rateLimitPerMinute: 3500,
    rateLimitPerDay: 200000,
    isActive: !!process.env.OPENAI_API_KEY,
  },
  {
    name: 'gpt-4o-mini',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
    endpoint: 'https://api.openai.com/v1',
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
    costPerInputToken: 0.00015 / 1000,
    costPerOutputToken: 0.0006 / 1000,
    rateLimitPerMinute: 3500,
    rateLimitPerDay: 200000,
    isActive: !!process.env.OPENAI_API_KEY,
  },
  {
    name: 'qwen-max',
    provider: 'qwen',
    apiKey: process.env.QWEN_API_KEY || 'your-qwen-api-key',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    costPerInputToken: 0.0001,
    costPerOutputToken: 0.0002,
    rateLimitPerMinute: 2000,
    rateLimitPerDay: 100000,
    isActive: !!process.env.QWEN_API_KEY,
  },
  {
    name: 'qwen-plus',
    provider: 'qwen',
    apiKey: process.env.QWEN_API_KEY || 'your-qwen-api-key',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    costPerInputToken: 0.00005,
    costPerOutputToken: 0.0001,
    rateLimitPerMinute: 2000,
    rateLimitPerDay: 100000,
    isActive: !!process.env.QWEN_API_KEY,
  },
  {
    name: 'deepseek-chat',
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY || 'your-deepseek-api-key',
    endpoint: 'https://api.deepseek.com/v1',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00002,
    rateLimitPerMinute: 2000,
    rateLimitPerDay: 100000,
    isActive: !!process.env.DEEPSEEK_API_KEY,
  },
  {
    name: 'gemini-pro',
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    costPerInputToken: 0.0,
    costPerOutputToken: 0.0,
    rateLimitPerMinute: 60,
    rateLimitPerDay: 1000,
    isActive: !!process.env.GEMINI_API_KEY,
  },
  {
    name: 'ollama-llama2',
    provider: 'ollama',
    apiKey: '',
    endpoint: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    costPerInputToken: 0.0,
    costPerOutputToken: 0.0,
    rateLimitPerMinute: 10000,
    rateLimitPerDay: 1000000,
    isActive: false, // Disabled by default, enable if Ollama is running
  },
];

async function main() {
  console.log('Seeding model configurations...');

  for (const config of defaultConfigs) {
    // Encrypt API key
    const encryptedApiKey = config.apiKey ? encrypt(config.apiKey) : '';

    await prisma.modelConfig.upsert({
      where: { name: config.name },
      update: {
        provider: config.provider,
        apiKey: encryptedApiKey,
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
        apiKey: encryptedApiKey,
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

    console.log(`✓ Seeded model config: ${config.name} (${config.provider})`);
  }

  console.log('Model configurations seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding model configurations:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
