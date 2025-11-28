import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script to populate database with common AI model configurations
 */
async function seedModelConfigs() {
    console.log('🌱 Seeding model configurations...');

    const models = [
        // OpenAI Models
        {
            name: 'gpt-4-turbo',
            provider: 'openai',
            apiKey: 'sk-placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 4096,
            costPerInputToken: 0.00001,
            costPerOutputToken: 0.00003,
            rateLimitPerMinute: 500,
            rateLimitPerDay: 10000,
            isActive: false, // Set to false initially, admin should configure
        },
        {
            name: 'gpt-3.5-turbo',
            provider: 'openai',
            apiKey: 'sk-placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 4096,
            costPerInputToken: 0.000001,
            costPerOutputToken: 0.000002,
            rateLimitPerMinute: 3500,
            rateLimitPerDay: 200000,
            isActive: false,
        },
        // Qwen (通义千问)
        {
            name: 'qwen-turbo',
            provider: 'qwen',
            apiKey: 'placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 2000,
            costPerInputToken: 0.000002,
            costPerOutputToken: 0.000006,
            rateLimitPerMinute: 60,
            isActive: false,
        },
        {
            name: 'qwen-max',
            provider: 'qwen',
            apiKey: 'placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 6000,
            costPerInputToken: 0.00004,
            costPerOutputToken: 0.00012,
            rateLimitPerMinute: 60,
            isActive: false,
        },
        // DeepSeek
        {
            name: 'deepseek-chat',
            provider: 'deepseek',
            apiKey: 'sk-placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 4096,
            costPerInputToken: 0.000001,
            costPerOutputToken: 0.000002,
            rateLimitPerMinute: 60,
            isActive: false,
        },
        {
            name: 'deepseek-coder',
            provider: 'deepseek',
            apiKey: 'sk-placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 4096,
            costPerInputToken: 0.000001,
            costPerOutputToken: 0.000002,
            rateLimitPerMinute: 60,
            isActive: false,
        },
        // Google Gemini
        {
            name: 'gemini-pro',
            provider: 'gemini',
            apiKey: 'placeholder-please-update',
            defaultTemperature: 0.7,
            defaultMaxTokens: 2048,
            costPerInputToken: 0.0000005,
            costPerOutputToken: 0.0000015,
            rateLimitPerMinute: 60,
            isActive: false,
        },
        // Ollama  (Local)
        {
            name: 'ollama-llama2',
            provider: 'ollama',
            apiKey: 'not-required',
            endpoint: 'http://localhost:11434',
            defaultTemperature: 0.7,
            defaultMaxTokens: 2048,
            costPerInputToken: 0, // Free for local models
            costPerOutputToken: 0,
            rateLimitPerMinute: 0, // No limit for local
            isActive: false,
        },
    ];

    let created = 0;
    let skipped = 0;

    for (const model of models) {
        try {
            const existing = await prisma.modelConfig.findUnique({
                where: { name: model.name },
            });

            if (existing) {
                console.log(`⏭️  Skipped: ${model.name} - already exists`);
                skipped++;
                continue;
            }

            await prisma.modelConfig.create({
                data: model,
            });

            console.log(`✅ Created: ${model.name} (${model.provider})`);
            created++;
        } catch (error) {
            console.error(`❌ Failed to create model ${model.name}:`, error);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📝 Total: ${models.length}\n`);

    if (created > 0) {
        console.log(
            '⚠️  NOTE: All models are disabled by default. Please update API keys and enable models through the admin interface.\n'
        );
    }
}

async function main() {
    try {
        await seedModelConfigs();
        console.log('✨ Seeding completed successfully!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
