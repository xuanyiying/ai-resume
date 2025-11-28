/**
 * Prompt Template Interfaces
 * Defines the structure for prompt templates and versions
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

/**
 * Prompt Template interface
 * Represents a prompt template for a specific scenario
 */
export interface PromptTemplate {
  id: string;
  name: string;
  scenario: string;
  language: string; // Added to support multi-language prompts
  template: string;
  variables: string[];
  version: number;
  provider?: string; // Optional: provider-specific template
  isEncrypted: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prompt Template Version interface
 * Represents a version of a prompt template
 */
export interface PromptTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  variables: string[];
  author: string;
  reason?: string;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Predefined scenarios for prompt templates
 */
export enum PromptScenario {
  RESUME_PARSING = 'resume_parsing',
  JOB_DESCRIPTION_PARSING = 'job_description_parsing',
  RESUME_OPTIMIZATION = 'resume_optimization',
  INTERVIEW_QUESTION_GENERATION = 'interview_question_generation',
  MATCH_SCORE_CALCULATION = 'match_score_calculation',
}

/**
 * Template rendering context
 */
export interface TemplateRenderContext {
  [key: string]: string | number | boolean;
}
