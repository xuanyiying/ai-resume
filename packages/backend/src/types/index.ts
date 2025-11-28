/**
 * Shared types for AI module
 * Prevents duplication of type definitions
 */

/**
 * Parsed resume data structure
 * Used across AI parsing and optimization features
 */
export interface ParsedResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
    achievements?: string[];
  }>;
  experience: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    location?: string;
    description: string[];
    achievements?: string[];
  }>;
  skills: string[];
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    startDate?: string;
    endDate?: string;
    url?: string;
    highlights: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
    expiryDate?: string;
    credentialId?: string;
  }>;
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
}

/**
 * Prompt template structure
 * Defines a reusable prompt template with variables
 */
export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
}

/**
 * Retry configuration
 * Controls retry behavior for API calls
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Job description parsed data
 */
export interface ParsedJobDescription {
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears?: number;
  educationLevel?: string;
  responsibilities: string[];
  keywords: string[];
}

/**
 * Resume optimization suggestion
 */
export interface OptimizationSuggestion {
  type: 'content' | 'keyword' | 'structure' | 'quantification';
  section: string;
  itemIndex?: number;
  original: string;
  optimized: string;
  reason: string;
}

/**
 * Interview question
 */
export interface InterviewQuestion {
  questionType: 'behavioral' | 'technical' | 'situational' | 'resume_based';
  question: string;
  suggestedAnswer: string;
  tips: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ParsedJobData {
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears?: number;
  educationLevel?: string;
  responsibilities: string[];
  keywords: string[];
}

export interface JobInput {
  title: string;
  company: string;
  location?: string;
  jobType?: string;
  salaryRange?: string;
  jobDescription: string;
  requirements: string;
  sourceUrl?: string;
}
