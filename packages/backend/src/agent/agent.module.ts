import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AIProvidersModule } from '../ai-providers/ai-providers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import {
  EmbeddingService,
  VectorDbService,
  RAGService,
  ContextCompressorService,
  AgentCacheManagerService,
  JSONOutputHelper,
  BatchProcessorService,
  OptimizationMetricsCalculator,
} from './services';
import { PitchPerfectAgent } from './agents/pitch-perfect.agent';
import { PitchPerfectController } from './agents/pitch-perfect.controller';
import { StrategistAgent } from './agents/strategist.agent';
import { StrategistController } from './agents/strategist.controller';
import { RolePlayAgent } from './agents/role-play.agent';
import { RolePlayController } from './agents/role-play.controller';
import { WorkflowOrchestrator } from './workflows/workflow.orchestrator';
import {
  AgentManagementController,
  AgentMetricsController,
  AgentSessionController,
} from './controllers';

@Module({
  imports: [
    AIProvidersModule,
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    EmbeddingService,
    VectorDbService,
    RAGService,
    ContextCompressorService,
    AgentCacheManagerService,
    JSONOutputHelper,
    BatchProcessorService,
    OptimizationMetricsCalculator,
    PitchPerfectAgent,
    StrategistAgent,
    RolePlayAgent,
    WorkflowOrchestrator,
  ],
  controllers: [
    PitchPerfectController,
    StrategistController,
    RolePlayController,
    AgentManagementController,
    AgentMetricsController,
    AgentSessionController,
  ],
  exports: [
    EmbeddingService,
    VectorDbService,
    RAGService,
    ContextCompressorService,
    AgentCacheManagerService,
    JSONOutputHelper,
    BatchProcessorService,
    OptimizationMetricsCalculator,
    PitchPerfectAgent,
    StrategistAgent,
    RolePlayAgent,
    WorkflowOrchestrator,
  ],
})
export class AgentModule {}
