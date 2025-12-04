/**
 * AI Providers Module
 * NestJS module for AI provider integration
 * Requirements: 2.1, 2.2
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelConfigService, YamlConfigLoader } from './config';
import { ConfigWatcherService } from './config/config-watcher.service';
import { PromptTemplateManager } from './config/prompt-template.manager';
import { PromptVersionManager } from './config/prompt-version.manager';
import { AIProviderFactory } from './factory';
import { UsageTrackerService } from './tracking';
import { PerformanceMonitorService } from './monitoring';
import { SecurityService } from './security';
import { AILogger } from './logging/ai-logger';
import { AIEngineService } from './ai-engine.service';
import { AIController } from './ai.controller';
import { PromptAdminController } from './prompt-admin.controller';
import { ModelAdminController } from './model-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AIController, PromptAdminController, ModelAdminController],
  providers: [
    YamlConfigLoader,
    ModelConfigService,
    ConfigWatcherService,
    AIProviderFactory,
    PromptTemplateManager,
    PromptVersionManager,
    UsageTrackerService,
    PerformanceMonitorService,
    SecurityService,
    AILogger,
    AIEngineService,
  ],
  exports: [
    ModelConfigService,
    ConfigWatcherService,
    AIProviderFactory,
    PromptTemplateManager,
    PromptVersionManager,
    UsageTrackerService,
    PerformanceMonitorService,
    SecurityService,
    AILogger,
    AIEngineService,
  ],
})
export class AIProvidersModule {}
