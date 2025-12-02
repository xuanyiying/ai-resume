import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { ResumeModule } from './resume/resume.module';
import { JobModule } from './job/job.module';
import { OptimizationModule } from './optimization/optimization.module';
import { GenerateModule } from './generate/generate.module';
import { StorageModule } from './storage/storage.module';
import { TasksModule } from './tasks/tasks.module';
import { InterviewModule } from './interview/interview.module';
import { CommonModule } from './common/common.module';
import { QuotaModule } from './quota/quota.module';
import { LoggerModule } from './logger/logger.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ConversationModule } from './conversation/conversation.module';
import { EmailModule } from './email/email.module';
import { PaymentModule } from './payment/payment.module';
import { AIProvidersModule } from './ai-providers/ai-providers.module';
import { InvitationModule } from './invitation/invitation.module';
import { loggerConfig } from './logger/logger.config';
import {
  PerformanceMiddleware,
  CacheControlMiddleware,
} from './common/middleware/performance.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WinstonModule.forRoot(loggerConfig),
    LoggerModule,
    CommonModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    UserModule,
    ConversationModule,
    ResumeModule,
    JobModule,
    OptimizationModule,
    GenerateModule,
    StorageModule,
    TasksModule,
    InterviewModule,
    QuotaModule,
    MonitoringModule,
    EmailModule,
    PaymentModule,
    AIProvidersModule,
    InvitationModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware first to capture all requests
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');

    // Apply performance monitoring middleware to all routes
    consumer
      .apply(PerformanceMiddleware, CacheControlMiddleware)
      .forRoutes('*');
  }
}
