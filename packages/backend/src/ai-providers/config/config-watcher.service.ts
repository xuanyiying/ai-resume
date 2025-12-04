/**
 * Configuration Watcher Service
 * Monitors database for configuration changes and triggers provider reloads
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelConfigService } from './model-config.service';
import { AIProviderFactory } from '../factory/ai-provider.factory';

@Injectable()
export class ConfigWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConfigWatcherService.name);
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private lastCheckTimestamp: Date = new Date();
  private readonly checkIntervalMs = 30000; // Check every 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelConfigService: ModelConfigService,
    private readonly providerFactory: AIProviderFactory
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Starting configuration watcher...');
    this.startWatching();
  }

  onModuleDestroy(): void {
    this.stopWatching();
  }

  /**
   * Start watching for configuration changes
   */
  private startWatching(): void {
    this.watchInterval = setInterval(async () => {
      await this.checkForChanges();
    }, this.checkIntervalMs);

    this.logger.log(
      `Configuration watcher started (checking every ${this.checkIntervalMs}ms)`
    );
  }

  /**
   * Stop watching for configuration changes
   */
  private stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      this.logger.log('Configuration watcher stopped');
    }
  }

  /**
   * Check for configuration changes since last check
   */
  private async checkForChanges(): Promise<void> {
    try {
      const changedConfigs = await this.prisma.modelConfig.findMany({
        where: {
          updatedAt: {
            gt: this.lastCheckTimestamp,
          },
        },
      });

      if (changedConfigs.length > 0) {
        this.logger.log(
          `Detected ${changedConfigs.length} configuration changes`
        );

        // Refresh cache and reload providers
        await this.modelConfigService.refreshCache();
        await this.providerFactory.reloadProviders();

        this.logger.log('Providers reloaded with updated configurations');
      }

      this.lastCheckTimestamp = new Date();
    } catch (error) {
      this.logger.error(
        `Error checking for configuration changes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Manually trigger configuration reload
   */
  async triggerReload(): Promise<void> {
    this.logger.log('Manually triggering configuration reload...');
    await this.modelConfigService.refreshCache();
    await this.providerFactory.reloadProviders();
    this.lastCheckTimestamp = new Date();
    this.logger.log('Configuration reload completed');
  }
}
