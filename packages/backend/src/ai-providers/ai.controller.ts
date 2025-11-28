import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';
import { AIEngineService } from './ai-engine.service';
import { PromptTemplateManager } from './config/prompt-template.manager';
import { UsageTrackerService } from './tracking/usage-tracker.service';
import { PerformanceMonitorService } from './monitoring/performance-monitor.service';
import { AILogger } from './logging/ai-logger';
import { AIRequest, AIResponse } from './interfaces';

interface AuthRequest {
  user?: { id: string };
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private aiEngineService: AIEngineService,
    private promptTemplateManager: PromptTemplateManager,
    private usageTrackerService: UsageTrackerService,
    private performanceMonitorService: PerformanceMonitorService,
    private aiLogger: AILogger
  ) { }

  @Post('call')
  async callAI(
    @Body() request: AIRequest & { scenario?: string },
    @Request() req: AuthRequest
  ): Promise<AIResponse> {
    try {
      const userId = req.user?.id || 'anonymous';
      const scenario = request.scenario || 'general';
      this.logger.debug(
        `AI call request from user ${userId}: model=${request.model}, scenario=${scenario}`
      );
      const response = await this.aiEngineService.call(
        request,
        userId,
        scenario
      );
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI call failed: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Post('stream')
  async streamAI(
    @Body() request: AIRequest & { scenario?: string },
    @Request() req: AuthRequest
  ): Promise<{ message: string }> {
    try {
      const userId = req.user?.id || 'anonymous';
      const scenario = request.scenario || 'general';
      this.logger.debug(
        `AI stream request from user ${userId}: model=${request.model}, scenario=${scenario}`
      );
      return {
        message:
          'Streaming endpoint available via WebSocket or Server-Sent Events',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI stream failed: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('models')
  async getModels(
    @Query('provider') provider?: string
  ): Promise<{ models: any[]; total: number }> {
    try {
      const msg = provider
        ? `Getting available models for provider ${provider}`
        : 'Getting available models';
      this.logger.debug(msg);
      let models;
      if (provider) {
        models = this.aiEngineService.getModelsByProvider(provider);
      } else {
        models = this.aiEngineService.getAvailableModels();
      }
      return {
        models,
        total: models.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get models: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('models/:modelName')
  async getModelInfo(@Param('modelName') modelName: string): Promise<any> {
    try {
      this.logger.debug(`Getting info for model ${modelName}`);
      const modelInfo = this.aiEngineService.getModelInfo(modelName);
      if (!modelInfo) {
        throw new BadRequestException(`Model ${modelName} not found`);
      }
      return modelInfo;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get model info: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('cost')
  async getCostStatistics(
    @Request() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'model' | 'scenario' | 'user' = 'model'
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      const start = startDate ? new Date(startDate) : this.getDateDaysAgo(30);
      const end = endDate ? new Date(endDate) : new Date();
      this.logger.debug(
        `Getting cost statistics for user ${userId}: ${start.toISOString()} to ${end.toISOString()}, groupBy=${groupBy}`
      );
      const report = await this.aiEngineService.getCostReport(
        start,
        end,
        groupBy
      );
      return report;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get cost statistics: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('cost/export/:format')
  async exportCostReport(
    @Request() req: AuthRequest,
    @Param('format') format: 'csv' | 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'model' | 'scenario' | 'user' = 'model'
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      const start = startDate ? new Date(startDate) : this.getDateDaysAgo(30);
      const end = endDate ? new Date(endDate) : new Date();
      this.logger.debug(
        `Exporting cost report for user ${userId}: format=${format}`
      );
      const report = await this.aiEngineService.getCostReport(
        start,
        end,
        groupBy
      );
      if (format === 'csv') {
        const csv =
          await this.usageTrackerService.exportCostReportToCSV(report);
        return {
          format: 'csv',
          data: csv,
          filename: `cost-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`,
        };
      } else {
        const json =
          await this.usageTrackerService.exportCostReportToJSON(report);
        return {
          format: 'json',
          data: JSON.parse(json),
          filename: `cost-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.json`,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to export cost report: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('performance')
  async getPerformanceMetrics(
    @Query('model') model?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<any> {
    try {
      this.logger.debug(
        `Getting performance metrics${model ? ` for model ${model}` : ''}`
      );
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      if (model) {
        const metrics = await this.aiEngineService.getPerformanceMetrics(
          model,
          start,
          end
        );
        return metrics;
      } else {
        const allMetrics = await this.performanceMonitorService.getAllMetrics();
        return {
          metrics: allMetrics,
          total: allMetrics.length,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('performance/alerts')
  async getPerformanceAlerts(): Promise<any> {
    try {
      this.logger.debug('Getting performance alerts');
      const alerts = await this.aiEngineService.checkPerformanceAlerts();
      return {
        alerts,
        total: alerts.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance alerts: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('logs')
  async getLogs(
    @Request() req: AuthRequest,
    @Query('model') model?: string,
    @Query('provider') provider?: string,
    @Query('scenario') scenario?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      this.logger.debug(
        `Getting logs for user ${userId}: model=${model}, provider=${provider}, scenario=${scenario}`
      );
      const logs = await this.aiEngineService.getLogs({
        model,
        provider,
        scenario,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit, 10) : 100,
      });
      return {
        logs,
        total: logs.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get logs: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('logs/stats')
  async getLogStatistics(
    @Request() req: AuthRequest,
    @Query('model') model?: string,
    @Query('provider') provider?: string,
    @Query('scenario') scenario?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      this.logger.debug(
        `Getting log statistics for user ${userId}: model=${model}, provider=${provider}, scenario=${scenario}`
      );
      const stats = await this.aiLogger.getLogStatistics({
        model,
        provider,
        scenario,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      return stats;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get log statistics: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('templates')
  async getTemplates(
    @Query('scenario') scenario?: string,
    @Query('provider') provider?: string
  ): Promise<any> {
    try {
      this.logger.debug(
        `Getting templates${scenario ? ` for scenario ${scenario}` : ''}${provider ? ` and provider ${provider}` : ''}`
      );
      if (scenario) {
        const template = await this.promptTemplateManager.getTemplate(
          scenario,
          provider
        );
        if (!template) {
          throw new BadRequestException(
            `Template not found for scenario ${scenario}`
          );
        }
        return {
          template,
        };
      } else {
        const templates = await this.promptTemplateManager.getAllTemplates();
        return {
          templates,
          total: templates.length,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get templates: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Post('templates')
  async createTemplate(
    @Body()
    body: {
      name: string;
      scenario: string;
      template: string;
      variables: string[];
      provider?: string;
      isEncrypted?: boolean;
    },
    @Request() req: AuthRequest
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      this.logger.debug(
        `Creating template for user ${userId}: name=${body.name}, scenario=${body.scenario}`
      );
      if (!body.name || !body.name.trim()) {
        throw new BadRequestException('Template name is required');
      }
      if (!body.scenario || !body.scenario.trim()) {
        throw new BadRequestException('Scenario is required');
      }
      if (!body.template || !body.template.trim()) {
        throw new BadRequestException('Template content is required');
      }
      if (!Array.isArray(body.variables)) {
        throw new BadRequestException('Variables must be an array');
      }
      const template = await this.promptTemplateManager.createTemplate({
        name: body.name,
        scenario: body.scenario,
        template: body.template,
        variables: body.variables,
        provider: body.provider,
        isEncrypted: body.isEncrypted || false,
      });
      return {
        template,
        message: 'Template created successfully',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create template: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('templates/:scenario/versions')
  async getTemplateVersions(@Param('scenario') scenario: string): Promise<any> {
    try {
      this.logger.debug(`Getting versions for template scenario ${scenario}`);
      const versions = await this.promptTemplateManager.listVersions(scenario);
      return {
        versions,
        total: versions.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get template versions: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Post('templates/:scenario/rollback')
  async rollbackTemplate(
    @Request() req: AuthRequest,
    @Param('scenario') scenario: string,
    @Body() body: { version: number }
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      this.logger.debug(
        `Rolling back template for user ${userId}: scenario=${scenario}, version=${body.version}`
      );
      if (!body.version || body.version < 1) {
        throw new BadRequestException('Valid version number is required');
      }
      const template = await this.promptTemplateManager.rollback(
        scenario,
        body.version
      );
      return {
        template,
        message: `Template rolled back to version ${body.version}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to rollback template: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Post('templates/render')
  async renderTemplate(
    @Request() req: AuthRequest,
    @Body()
    body: {
      scenario: string;
      variables: Record<string, string>;
      provider?: string;
      version?: number;
    }
  ): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      this.logger.debug(
        `Rendering template for user ${userId}: scenario=${body.scenario}`
      );
      if (!body.scenario || !body.scenario.trim()) {
        throw new BadRequestException('Scenario is required');
      }
      if (!body.variables || typeof body.variables !== 'object') {
        throw new BadRequestException('Variables must be an object');
      }
      const template = await this.promptTemplateManager.getTemplate(
        body.scenario,
        'en', // default language
        body.provider,
        body.version
      );
      if (!template) {
        throw new BadRequestException(
          `Template not found for scenario ${body.scenario}`
        );
      }
      const rendered = await this.promptTemplateManager.renderTemplate(
        template,
        body.variables
      );
      return {
        rendered,
        template: template.name,
        scenario: body.scenario,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to render template: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Post('reload')
  async reloadModels(@Request() req: AuthRequest): Promise<any> {
    try {
      const userId = req.user?.id || 'anonymous';
      this.logger.debug(`Reloading models for user ${userId}`);
      await this.aiEngineService.reloadModels();
      const models = this.aiEngineService.getAvailableModels();
      return {
        message: 'Models reloaded successfully',
        totalModels: models.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to reload models: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  @Get('selection-stats')
  async getSelectionStatistics(): Promise<unknown> {
    try {
      this.logger.debug('Getting model selection statistics');
      const stats = this.aiEngineService.getSelectionStatistics();
      const log = this.aiEngineService.getSelectionLog(100);
      return {
        statistics: stats,
        recentSelections: log,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get selection statistics: ${errorMsg}`);
      throw new InternalServerErrorException(errorMsg);
    }
  }

  private getDateDaysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
