import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { ModelConfigService, ModelConfig } from './config/model-config.service';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';

/**
 * DTO for creating/updating model configurations
 */
interface CreateModelConfigDto {
    name: string;
    provider: string;
    apiKey: string;
    endpoint?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
    costPerInputToken?: number;
    costPerOutputToken?: number;
    rateLimitPerMinute?: number;
    rateLimitPerDay?: number;
    isActive?: boolean;
}

interface UpdateModelConfigDto {
    apiKey?: string;
    endpoint?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
    costPerInputToken?: number;
    costPerOutputToken?: number;
    rateLimitPerMinute?: number;
    rateLimitPerDay?: number;
    isActive?: boolean;
}

import { Roles } from '../user/decorators/roles.decorator';
import { RolesGuard } from '../user/guards/roles.guard';
import { Role } from '@prisma/client';

/**
 * Admin Controller for Model Configuration Management
 * Provides CRUD operations for AI model configurations
 */
@Controller('admin/models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ModelAdminController {
    constructor(private modelConfigService: ModelConfigService) { }

    /**
     * List all model configurations
     * GET /admin/models?provider=&isActive=&page=&limit=
     */
    @Get()
    async listModels(
        @Query('provider') provider?: string,
        @Query('isActive') isActive?: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '50'
    ) {
        let configs = await this.modelConfigService.getAllModelConfigs();

        if (provider) {
            configs = await this.modelConfigService.getConfigsByProvider(provider);
        }

        if (isActive !== undefined) {
            const activeFilter = isActive === 'true';
            configs = configs.filter((c) => c.isActive === activeFilter);
        }

        // Pagination
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const start = (pageNum - 1) * limitNum;
        const end = start + limitNum;

        // Mask API keys in response
        const maskedConfigs = configs.map((config) => ({
            ...config,
            apiKey: this.maskApiKey(config.apiKey),
        }));

        return {
            data: maskedConfigs.slice(start, end),
            total: configs.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(configs.length / limitNum),
        };
    }

    /**
     * Get a specific model configuration by name
     * GET /admin/models/:name
     */
    @Get(':name')
    async getModel(@Param('name') name: string) {
        const config = await this.modelConfigService.getModelConfig(name);

        if (!config) {
            throw new BadRequestException(`Model configuration ${name} not found`);
        }

        // Mask API key
        return {
            ...config,
            apiKey: this.maskApiKey(config.apiKey),
        };
    }

    /**
     * Create a new model configuration
     * POST /admin/models
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createModel(@Body() dto: CreateModelConfigDto) {
        const config: ModelConfig = {
            id: `manual-${dto.provider}-${Date.now()}`,
            name: dto.name,
            provider: dto.provider,
            apiKey: dto.apiKey,
            endpoint: dto.endpoint,
            defaultTemperature: dto.defaultTemperature ?? 0.7,
            defaultMaxTokens: dto.defaultMaxTokens ?? 2000,
            costPerInputToken: dto.costPerInputToken ?? 0,
            costPerOutputToken: dto.costPerOutputToken ?? 0,
            rateLimitPerMinute: dto.rateLimitPerMinute ?? 0,
            rateLimitPerDay: dto.rateLimitPerDay ?? 0,
            isActive: dto.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const created = await this.modelConfigService.upsertModelConfig(config);

        return {
            ...created,
            apiKey: this.maskApiKey(created.apiKey),
        };
    }

    /**
     * Update a model configuration
     * PUT /admin/models/:name
     */
    @Put(':name')
    async updateModel(
        @Param('name') name: string,
        @Body() dto: UpdateModelConfigDto
    ) {
        const existing = await this.modelConfigService.getModelConfig(name);

        if (!existing) {
            throw new BadRequestException(`Model configuration ${name} not found`);
        }

        const updated: ModelConfig = {
            ...existing,
            ...dto,
            updatedAt: new Date(),
        };

        const result = await this.modelConfigService.upsertModelConfig(updated);

        return {
            ...result,
            apiKey: this.maskApiKey(result.apiKey),
        };
    }

    /**
     * Delete a model configuration
     * DELETE /admin/models/:name
     */
    @Delete(':name')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteModel(@Param('name') name: string) {
        await this.modelConfigService.deleteModelConfig(name);
    }

    /**
     * Enable a model configuration
     * POST /admin/models/:name/enable
     */
    @Post(':name/enable')
    async enableModel(@Param('name') name: string) {
        await this.modelConfigService.enableModelConfig(name);
        return { message: `Model ${name} enabled successfully` };
    }

    /**
     * Disable a model configuration
     * POST /admin/models/:name/disable
     */
    @Post(':name/disable')
    async disableModel(@Param('name') name: string) {
        await this.modelConfigService.disableModelConfig(name);
        return { message: `Model ${name} disabled successfully` };
    }

    /**
     * Test model connection
     * POST /admin/models/:name/test
     */
    @Post(':name/test')
    async testModel(@Param('name') name: string) {
        const config = await this.modelConfigService.getModelConfig(name);

        if (!config) {
            throw new BadRequestException(`Model configuration ${name} not found`);
        }

        // Simple validation - check if API key exists
        const isValid = !!config.apiKey && config.apiKey.length > 0;

        return {
            name: config.name,
            provider: config.provider,
            status: isValid ? 'valid' : 'invalid',
            message: isValid
                ? 'Model configuration is valid'
                : 'Model configuration is missing API key',
        };
    }

    /**
     * Refresh configuration cache
     * POST /admin/models/refresh
     */
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshCache() {
        await this.modelConfigService.refreshCache();
        return { message: 'Configuration cache refreshed successfully' };
    }

    /**
     * Get usage statistics for all models
     * GET /admin/models/stats/usage
     */
    @Get('stats/usage')
    async getUsageStats() {
        // This would integrate with UsageTrackerService
        // For now, return placeholder
        return {
            message: 'Usage statistics to be implemented',
            data: [],
        };
    }

    /**
     * Mask API key for security
     */
    private maskApiKey(apiKey: string): string {
        if (!apiKey || apiKey.length < 8) {
            return '****';
        }
        return `${apiKey.slice(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
    }
}
