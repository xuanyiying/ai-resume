import { Tool } from '@langchain/core/tools';
import { AIEngine } from '../../ai/ai.engine';
import { ParsedJobDescription } from '@/types';

/**
 * JD Analyzer Tool
 * Analyzes job descriptions and extracts key requirements
 * Requirements: 1.4, 2.2
 */
export class JDAnalyzerTool extends Tool {
  name = 'jd_analyzer';
  description = 'Analyzes job descriptions and extracts key requirements';

  constructor(private aiEngine: AIEngine) {
    super();
  }

  async _call(jobDescription: string): Promise<string> {
    try {
      const parsedData: ParsedJobDescription =
        await this.aiEngine.parseJobDescription(jobDescription);
      return JSON.stringify(parsedData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Failed to analyze job description: ${errorMessage}`,
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        keywords: [],
      });
    }
  }
}
