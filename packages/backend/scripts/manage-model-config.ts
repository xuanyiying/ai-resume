#!/usr/bin/env ts-node
/**
 * Model Configuration Management CLI
 * Usage:
 *   npm run model-config list
 *   npm run model-config add <name> <provider> <apiKey>
 *   npm run model-config enable <name>
 *   npm run model-config disable <name>
 *   npm run model-config delete <name>
 *   npm run model-config status
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

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

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function listConfigs() {
  const configs = await prisma.modelConfig.findMany({
    orderBy: [{ provider: 'asc' }, { name: 'asc' }],
  });

  console.log('\n📋 Model Configurations:\n');
  console.log('Name'.padEnd(25), 'Provider'.padEnd(15), 'Active'.padEnd(10), 'Endpoint');
  console.log('─'.repeat(80));

  for (const config of configs) {
    const status = config.isActive ? '✅ Yes' : '❌ No';
    console.log(
      config.name.padEnd(25),
      config.provider.padEnd(15),
      status.padEnd(10),
      config.endpoint || 'default'
    );
  }

  console.log(`\nTotal: ${configs.length} configurations\n`);
}

async function addConfig(name: string, provider: string, apiKey: string) {
  const encryptedApiKey = encrypt(apiKey);

  const config = await prisma.modelConfig.create({
    data: {
      name,
      provider,
      apiKey: encryptedApiKey,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2000,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      rateLimitPerMinute: 0,
      rateLimitPerDay: 0,
      isActive: true,
    },
  });

  console.log(`✅ Added model configuration: ${config.name}`);
}

async function enableConfig(name: string) {
  await prisma.modelConfig.update({
    where: { name },
    data: { isActive: true },
  });

  console.log(`✅ Enabled model configuration: ${name}`);
}

async function disableConfig(name: string) {
  await prisma.modelConfig.update({
    where: { name },
    data: { isActive: false },
  });

  console.log(`❌ Disabled model configuration: ${name}`);
}

async function deleteConfig(name: string) {
  await prisma.modelConfig.delete({
    where: { name },
  });

  console.log(`🗑️  Deleted model configuration: ${name}`);
}

async function showStatus() {
  const configs = await prisma.modelConfig.findMany();
  const activeCount = configs.filter(c => c.isActive).length;
  const inactiveCount = configs.length - activeCount;

  const providers = [...new Set(configs.map(c => c.provider))];

  console.log('\n📊 Configuration Status:\n');
  console.log(`Total Configurations: ${configs.length}`);
  console.log(`Active: ${activeCount}`);
  console.log(`Inactive: ${inactiveCount}`);
  console.log(`\nProviders: ${providers.join(', ')}`);

  console.log('\n📈 By Provider:\n');
  for (const provider of providers) {
    const providerConfigs = configs.filter(c => c.provider === provider);
    const activeProviderConfigs = providerConfigs.filter(c => c.isActive);
    console.log(`  ${provider}: ${activeProviderConfigs.length}/${providerConfigs.length} active`);
  }
  console.log();
}

async function showConfig(name: string) {
  const config = await prisma.modelConfig.findUnique({
    where: { name },
  });

  if (!config) {
    console.error(`❌ Configuration not found: ${name}`);
    return;
  }

  console.log('\n📄 Configuration Details:\n');
  console.log(`Name: ${config.name}`);
  console.log(`Provider: ${config.provider}`);
  console.log(`Endpoint: ${config.endpoint || 'default'}`);
  console.log(`Temperature: ${config.defaultTemperature}`);
  console.log(`Max Tokens: ${config.defaultMaxTokens}`);
  console.log(`Cost (Input): $${config.costPerInputToken}/1K tokens`);
  console.log(`Cost (Output): $${config.costPerOutputToken}/1K tokens`);
  console.log(`Rate Limit: ${config.rateLimitPerMinute}/min, ${config.rateLimitPerDay}/day`);
  console.log(`Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
  console.log(`Created: ${config.createdAt.toISOString()}`);
  console.log(`Updated: ${config.updatedAt.toISOString()}`);
  
  // Show masked API key
  try {
    const decryptedKey = decrypt(config.apiKey);
    const maskedKey = decryptedKey.length > 8 
      ? `${decryptedKey.slice(0, 4)}...${decryptedKey.slice(-4)}`
      : '****';
    console.log(`API Key: ${maskedKey}`);
  } catch {
    console.log(`API Key: [encrypted]`);
  }
  
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'list':
        await listConfigs();
        break;

      case 'add':
        if (args.length < 4) {
          console.error('Usage: npm run model-config add <name> <provider> <apiKey>');
          process.exit(1);
        }
        await addConfig(args[1], args[2], args[3]);
        break;

      case 'enable':
        if (args.length < 2) {
          console.error('Usage: npm run model-config enable <name>');
          process.exit(1);
        }
        await enableConfig(args[1]);
        break;

      case 'disable':
        if (args.length < 2) {
          console.error('Usage: npm run model-config disable <name>');
          process.exit(1);
        }
        await disableConfig(args[1]);
        break;

      case 'delete':
        if (args.length < 2) {
          console.error('Usage: npm run model-config delete <name>');
          process.exit(1);
        }
        await deleteConfig(args[1]);
        break;

      case 'status':
        await showStatus();
        break;

      case 'show':
        if (args.length < 2) {
          console.error('Usage: npm run model-config show <name>');
          process.exit(1);
        }
        await showConfig(args[1]);
        break;

      default:
        console.log('Model Configuration Management CLI\n');
        console.log('Usage:');
        console.log('  npm run model-config list                          - List all configurations');
        console.log('  npm run model-config show <name>                   - Show configuration details');
        console.log('  npm run model-config add <name> <provider> <key>   - Add new configuration');
        console.log('  npm run model-config enable <name>                 - Enable configuration');
        console.log('  npm run model-config disable <name>                - Disable configuration');
        console.log('  npm run model-config delete <name>                 - Delete configuration');
        console.log('  npm run model-config status                        - Show status summary');
        console.log();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
