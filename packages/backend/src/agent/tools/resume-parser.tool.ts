import { Tool } from '@langchain/core/tools';
import { AIEngine } from '../../ai/ai.engine';
import { ParsedResumeData } from '@/types';

/**
 * Resume Parser Tool
 * Parses resume content and extracts structured information
 * Requirements: 1.4, 2.2
 */
export class ResumeParserTool extends Tool {
  name = 'resume_parser';
  description = 'Parses resume content and extracts structured information';

  constructor(private aiEngine: AIEngine) {
    super();
  }

  async _call(resumeContent: string): Promise<string> {
    try {
      const parsedData: ParsedResumeData =
        await this.aiEngine.parseResumeContent(resumeContent);
      return JSON.stringify(parsedData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Failed to parse resume: ${errorMessage}`,
        personalInfo: { name: '', email: '' },
        education: [],
        experience: [],
        skills: [],
        projects: [],
      });
    }
  }
}
