import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PromptTemplate,
  PromptTemplateVersion,
  PromptScenario,
  TemplateRenderContext,
} from '../interfaces/prompt-template.interface';
import { PREDEFINED_TEMPLATES } from './predefined-templates';

/**
 * Prompt Template Manager
 * Manages prompt templates for different scenarios
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
@Injectable()
export class PromptTemplateManager {
  private readonly logger = new Logger(PromptTemplateManager.name);
  private templateCache: Map<string, PromptTemplate> = new Map();

  constructor(private prisma: PrismaService) {
    this.initializePredefinedTemplates();
  }

  /**
   * Initialize predefined templates for all scenarios
   * Property 16: Predefined templates exist
   * Validates: Requirements 4.2
   */
  private async initializePredefinedTemplates(): Promise<void> {
    const predefinedTemplates = this.getPredefinedTemplates();

    for (const template of predefinedTemplates) {
      try {
        const existing = await this.prisma.promptTemplate.findUnique({
          where: {
            name_language: {
              name: template.name,
              language: template.language
            }
          },
        });

        if (!existing) {
          await this.prisma.promptTemplate.create({
            data: {
              name: template.name,
              scenario: template.scenario,
              language: template.language,
              template: template.template,
              variables: template.variables,
              provider: template.provider,
              isEncrypted: template.isEncrypted,
              isActive: true,
            },
          });
          this.logger.log(`Created predefined template: ${template.name} (${template.language})`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to initialize template ${template.name} (${template.language}):`,
          error
        );
      }
    }
  }

  /**
   * Get predefined templates for all scenarios
   */
  private getPredefinedTemplates() {
    return PREDEFINED_TEMPLATES;
  }

  /**
   * Get a template by scenario and optional provider
   * Property 15: Multiple template support
   * Validates: Requirements 4.1
   */
  async getTemplate(
    scenario: string,
    language: string = 'en',
    provider?: string,
    version?: number
  ): Promise<PromptTemplate | null> {
    try {
      // Try to get provider-specific template first
      if (provider) {
        const cacheKey = `${scenario}:${language}:${provider}:${version || 'latest'}`;
        if (this.templateCache.has(cacheKey)) {
          return this.templateCache.get(cacheKey) || null;
        }

        const template = await this.prisma.promptTemplate.findFirst({
          where: {
            scenario,
            language,
            provider,
            isActive: true,
          },
        });

        if (template) {
          this.templateCache.set(cacheKey, template as PromptTemplate);
          return template as PromptTemplate;
        }
      }

      // Fall back to generic template for specified language
      const cacheKey = `${scenario}:${language}:generic:${version || 'latest'}`;
      if (this.templateCache.has(cacheKey)) {
        return this.templateCache.get(cacheKey) || null;
      }

      const template = await this.prisma.promptTemplate.findFirst({
        where: {
          scenario,
          language,
          provider: null,
          isActive: true,
        },
      });

      if (template) {
        this.templateCache.set(cacheKey, template as PromptTemplate);
        return template as PromptTemplate;
      }

      // Fall back to English if requested language not found
      if (language !== 'en') {
        return this.getTemplate(scenario, 'en', provider, version);
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get template for scenario ${scenario} (${language}):`,
        error
      );
      return null;
    }
  }

  /**
   * Render a template with provided variables
   * Property 18: Template rendering correctness (round-trip property)
   * Validates: Requirements 4.4
   */
  async renderTemplate(
    template: PromptTemplate,
    variables: TemplateRenderContext
  ): Promise<string> {
    try {
      let rendered = template.template;

      // Replace all variables in the template
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        const stringValue = String(value);
        // Use a function to avoid regex special character issues
        rendered = rendered.split(placeholder).join(stringValue);
      }

      // Check if all required variables were provided
      const unreplacedPlaceholders = rendered.match(/{[^}]+}/g);
      if (unreplacedPlaceholders && unreplacedPlaceholders.length > 0) {
        this.logger.warn(
          `Template rendering left unreplaced placeholders: ${unreplacedPlaceholders.join(', ')}`
        );
      }

      return rendered;
    } catch (error) {
      this.logger.error('Failed to render template:', error);
      throw error;
    }
  }

  /**
   * Create a new version of a template
   * Property 53: Prompt template version creation
   * Validates: Requirements 10.1
   */
  async createVersion(
    scenario: string,
    templateContent: string,
    reason: string,
    author: string,
    provider?: string
  ): Promise<PromptTemplateVersion> {
    try {
      // Get or create the base template
      let template = await this.prisma.promptTemplate.findFirst({
        where: {
          scenario,
          provider: provider || null,
        },
      });

      if (!template) {
        template = await this.prisma.promptTemplate.create({
          data: {
            name: `${scenario}_${provider || 'generic'}_${Date.now()}`,
            scenario,
            template: templateContent,
            variables: this.extractVariables(templateContent),
            provider,
            isEncrypted: false,
            isActive: true,
          },
        });
      }

      // Get the next version number
      const lastVersion = await this.prisma.promptTemplateVersion.findFirst({
        where: { templateId: template.id },
        orderBy: { version: 'desc' },
      });

      const nextVersion = (lastVersion?.version || 0) + 1;

      // Create new version
      const version = await this.prisma.promptTemplateVersion.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          content: templateContent,
          variables: this.extractVariables(templateContent),
          author,
          reason,
          isActive: false,
        },
      });

      // Update the main template
      await this.prisma.promptTemplate.update({
        where: { id: template.id },
        data: {
          template: templateContent,
          variables: this.extractVariables(templateContent),
          version: nextVersion,
        },
      });

      // Clear cache
      this.templateCache.clear();

      this.logger.log(
        `Created version ${nextVersion} for template ${scenario}`
      );

      return version as PromptTemplateVersion;
    } catch (error) {
      this.logger.error('Failed to create template version:', error);
      throw error;
    }
  }

  /**
   * List all versions of a template
   * Property 54: Version metadata recording
   * Validates: Requirements 10.2
   */
  async listVersions(scenario: string): Promise<PromptTemplateVersion[]> {
    try {
      const template = await this.prisma.promptTemplate.findFirst({
        where: { scenario },
      });

      if (!template) {
        return [];
      }

      const versions = await this.prisma.promptTemplateVersion.findMany({
        where: { templateId: template.id },
        orderBy: { version: 'desc' },
      });

      return versions as PromptTemplateVersion[];
    } catch (error) {
      this.logger.error(
        `Failed to list versions for scenario ${scenario}:`,
        error
      );
      return [];
    }
  }

  /**
   * Rollback to a specific version
   * Property 57: Version rollback
   * Validates: Requirements 10.5
   */
  async rollback(
    scenario: string,
    version: number
  ): Promise<PromptTemplate | null> {
    try {
      const template = await this.prisma.promptTemplate.findFirst({
        where: { scenario },
      });

      if (!template) {
        this.logger.warn(`Template not found for scenario ${scenario}`);
        return null;
      }

      const targetVersion = await this.prisma.promptTemplateVersion.findUnique({
        where: {
          templateId_version: {
            templateId: template.id,
            version,
          },
        },
      });

      if (!targetVersion) {
        this.logger.warn(
          `Version ${version} not found for template ${scenario}`
        );
        return null;
      }

      // Update the main template to use this version
      const updated = await this.prisma.promptTemplate.update({
        where: { id: template.id },
        data: {
          template: targetVersion.content,
          variables: targetVersion.variables,
          version,
        },
      });

      // Clear cache
      this.templateCache.clear();

      this.logger.log(`Rolled back template ${scenario} to version ${version}`);

      return updated as PromptTemplate;
    } catch (error) {
      this.logger.error(
        `Failed to rollback template ${scenario} to version ${version}:`,
        error
      );
      return null;
    }
  }

  /**
   * Extract variables from a template string
   * Finds all {variable_name} patterns
   */
  private extractVariables(template: string): string[] {
    const matches = template.match(/{([^}]+)}/g);
    if (!matches) {
      return [];
    }

    const uniqueVars = new Set(matches.map((m) => m.slice(1, -1)));
    return Array.from(uniqueVars);
  }

  /**
   * Clear the template cache
   * Property 20: Dynamic template loading
   * Validates: Requirements 4.6
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }

  /**
   * Reload all templates from database
   */
  async reloadTemplates(): Promise<void> {
    try {
      this.clearCache();
      await this.initializePredefinedTemplates();
      this.logger.log('Templates reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload templates:', error);
    }
  }

  /**
   * Get all templates
   * Property 15: Multiple template support
   * Validates: Requirements 4.1
   */
  async getAllTemplates(): Promise<PromptTemplate[]> {
    try {
      const templates = await this.prisma.promptTemplate.findMany({
        where: { isActive: true },
        orderBy: { scenario: 'asc' },
      });

      return templates as PromptTemplate[];
    } catch (error) {
      this.logger.error('Failed to get all templates:', error);
      return [];
    }
  }

  /**
   * Create a new template
   * Property 15: Multiple template support
   * Validates: Requirements 4.1
   */
  async createTemplate(data: {
    name: string;
    scenario: string;
    language?: string;
    template: string;
    variables: string[];
    provider?: string;
    isEncrypted?: boolean;
  }): Promise<PromptTemplate> {
    try {
      const created = await this.prisma.promptTemplate.create({
        data: {
          name: data.name,
          scenario: data.scenario,
          language: data.language || 'en',
          template: data.template,
          variables: data.variables,
          provider: data.provider,
          isEncrypted: data.isEncrypted || false,
          isActive: true,
        },
      });

      // Clear cache
      this.templateCache.clear();

      this.logger.log(`Created template: ${data.name} (${data.language || 'en'})`);

      return created as PromptTemplate;
    } catch (error) {
      this.logger.error('Failed to create template:', error);
      throw error;
    }
  }
}
