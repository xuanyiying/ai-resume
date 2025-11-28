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
import { PromptTemplateManager } from './config/prompt-template.manager';
import { PromptTemplate, PromptTemplateVersion } from '@prisma/client';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';

/**
 * DTO for creating/updating prompt templates
 */
interface CreatePromptDto {
    name: string;
    scenario: string;
    language?: string;
    template: string;
    variables?: string[];
    provider?: string;
    isEncrypted?: boolean;
}

interface UpdatePromptDto {
    template?: string;
    variables?: string[];
    isActive?: boolean;
}

interface CreateVersionDto {
    templateContent: string;
    reason: string;
    author: string;
}

interface RollbackDto {
    version: number;
}

import { Roles } from '../user/decorators/roles.decorator';
import { RolesGuard } from '../user/guards/roles.guard';
import { Role } from '@prisma/client';

/**
 * Admin Controller for Prompt Template Management
 * Provides CRUD operations and version control for prompt templates
 */
@Controller('admin/prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PromptAdminController {
    constructor(private promptTemplateManager: PromptTemplateManager) { }

    /**
     * List all prompt templates
     * GET /admin/prompts?scenario=&language=&page=&limit=
     */
    @Get()
    async listPrompts(
        @Query('scenario') scenario?: string,
        @Query('language') language?: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '50'
    ) {
        const allTemplates = await this.promptTemplateManager.getAllTemplates();

        let filtered = allTemplates;

        if (scenario) {
            filtered = filtered.filter((t) => t.scenario === scenario);
        }

        if (language) {
            filtered = filtered.filter((t) => t.language === language);
        }

        // Pagination
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const start = (pageNum - 1) * limitNum;
        const end = start + limitNum;

        return {
            data: filtered.slice(start, end),
            total: filtered.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(filtered.length / limitNum),
        };
    }

    /**
     * Get a specific prompt template by ID
     * GET /admin/prompts/:id
     */
    @Get(':id')
    async getPrompt(@Param('id') id: string) {
        // Note: We'll need to add a getById method to PromptTemplateManager
        // For now, get all and filter
        const templates = await this.promptTemplateManager.getAllTemplates();
        const template = templates.find((t) => t.id === id);

        if (!template) {
            throw new BadRequestException(`Prompt template with ID ${id} not found`);
        }

        return template;
    }

    /**
     * Create a new prompt template
     * POST /admin/prompts
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createPrompt(@Body() dto: CreatePromptDto) {
        return await this.promptTemplateManager.createTemplate({
            name: dto.name,
            scenario: dto.scenario,
            language: dto.language || 'en',
            template: dto.template,
            variables: dto.variables || this.extractVariables(dto.template),
            provider: dto.provider,
            isEncrypted: dto.isEncrypted || false,
        });
    }

    /**
     * Update a prompt template
     * PUT /admin/prompts/:id
     */
    @Put(':id')
    async updatePrompt(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
        // For simplicity, we'll need to add an update method
        // For now, return a placeholder
        throw new BadRequestException('Update functionality to be implemented');
    }

    /**
     * Delete a prompt template
     * DELETE /admin/prompts/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deletePrompt(@Param('id') id: string) {
        // Delete functionality to be added to PromptTemplateManager
        throw new BadRequestException('Delete functionality to be implemented');
    }

    /**
     * Create a new version of a prompt template
     * POST /admin/prompts/:scenario/versions
     */
    @Post(':scenario/versions')
    @HttpCode(HttpStatus.CREATED)
    async createVersion(
        @Param('scenario') scenario: string,
        @Body() dto: CreateVersionDto
    ) {
        return await this.promptTemplateManager.createVersion(
            scenario,
            dto.templateContent,
            dto.reason,
            dto.author
        );
    }

    /**
     * List all versions of a prompt template
     * GET /admin/prompts/:scenario/versions
     */
    @Get(':scenario/versions')
    async listVersions(@Param('scenario') scenario: string) {
        return await this.promptTemplateManager.listVersions(scenario);
    }

    /**
     * Rollback to a specific version
     * POST /admin/prompts/:scenario/rollback
     */
    @Post(':scenario/rollback')
    async rollback(
        @Param('scenario') scenario: string,
        @Body() dto: RollbackDto
    ) {
        const result = await this.promptTemplateManager.rollback(
            scenario,
            dto.version
        );

        if (!result) {
            throw new BadRequestException(
                `Failed to rollback to version ${dto.version}`
            );
        }

        return result;
    }

    /**
     * Reload prompt templates from database
     * POST /admin/prompts/reload
     */
    @Post('reload')
    @HttpCode(HttpStatus.OK)
    async reloadTemplates() {
        await this.promptTemplateManager.reloadTemplates();
        return { message: 'Templates reloaded successfully' };
    }

    /**
     * Helper method to extract variables from template
     */
    private extractVariables(template: string): string[] {
        const matches = template.match(/{([^}]+)}/g);
        if (!matches) {
            return [];
        }
        const uniqueVars = new Set(matches.map((m) => m.slice(1, -1)));
        return Array.from(uniqueVars);
    }
}
