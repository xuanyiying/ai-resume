import { Tool } from '@langchain/core/tools';

export interface KeywordMatchInput {
  resumeHighlights: string[];
  jobKeywords: string[];
}

export interface KeywordMatchResult {
  matched: string[];
  missing: string[];
  overlapPercentage: number;
}

/**
 * Keyword Matcher Tool
 * Matches resume highlights with job description keywords
 * Requirements: 2.3, 2.6
 */
export class KeywordMatcherTool extends Tool {
  name = 'keyword_matcher';
  description = 'Matches resume highlights with job description keywords';

  async _call(input: string): Promise<string> {
    try {
      const parsedInput: KeywordMatchInput = JSON.parse(input);
      const result = this.matchKeywords(
        parsedInput.resumeHighlights,
        parsedInput.jobKeywords
      );
      return JSON.stringify(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Failed to match keywords: ${errorMessage}`,
        matched: [],
        missing: [],
        overlapPercentage: 0,
      });
    }
  }

  /**
   * Calculate keyword overlap between resume highlights and job keywords
   * Property 9: Keyword Overlap Calculation
   * Validates: Requirements 2.6
   */
  private matchKeywords(
    resumeHighlights: string[],
    jobKeywords: string[]
  ): KeywordMatchResult {
    // Normalize keywords to lowercase for comparison
    const normalizedJobKeywords = jobKeywords.map((k) => k.toLowerCase());
    const normalizedHighlights = resumeHighlights.map((h) => h.toLowerCase());

    // Find matched keywords
    const matched: string[] = [];
    const missing: string[] = [];

    for (const keyword of normalizedJobKeywords) {
      let found = false;

      for (const highlight of normalizedHighlights) {
        if (highlight.includes(keyword) || keyword.includes(highlight)) {
          matched.push(keyword);
          found = true;
          break;
        }
      }

      if (!found) {
        missing.push(keyword);
      }
    }

    // Calculate overlap percentage
    const overlapPercentage =
      normalizedJobKeywords.length > 0
        ? (matched.length / normalizedJobKeywords.length) * 100
        : 0;

    return {
      matched,
      missing,
      overlapPercentage: Math.round(overlapPercentage * 100) / 100,
    };
  }
}
