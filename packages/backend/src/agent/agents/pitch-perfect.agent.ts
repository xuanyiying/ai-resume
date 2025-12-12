import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { PromptTemplateManager } from '../../ai-providers/config/prompt-template.manager';
import { ParsedResumeData } from '../../types';

/**
 * Input interface for Pitch Perfect Agent
 */
export interface PitchPerfectAgentInput {
  resumeData: ParsedResumeData;
  jobDescription: string;
  style: 'technical' | 'managerial' | 'sales';
  duration: 30 | 60; // seconds
}

/**
 * Output interface for Pitch Perfect Agent
 */
export interface PitchPerfectAgentOutput {
  introduction: string;
  highlights: string[];
  keywordOverlap: {
    matched: string[];
    missing: string[];
    overlapPercentage: number;
  };
  suggestions: string[];
}

/**
 * STAR Achievement structure
 */
interface STARAchievement {
  situation: string;
  task: string;
  action: string;
  result: string;
  fullText: string;
}

/**
 * Pitch Perfect Agent
 * Generates optimized personal introductions for specific job positions
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
@Injectable()
export class PitchPerfectAgent {
  private readonly logger = new Logger(PitchPerfectAgent.name);

  constructor(
    private aiEngineService: AIEngineService,
    private promptTemplateManager: PromptTemplateManager
  ) {}

  /**
   * Generate optimized introduction
   * Main entry point for the agent
   * Validates: Requirements 2.1-2.7
   */
  async generate(
    input: PitchPerfectAgentInput,
    userId: string
  ): Promise<PitchPerfectAgentOutput> {
    this.logger.log(
      `Generating introduction for user ${userId} with style ${input.style} and duration ${input.duration}s`
    );

    // Step 1: Extract STAR achievements
    const achievements = await this.extractSTARachievements(
      input.resumeData,
      userId
    );

    // Step 2: Match with JD keywords
    const matchedHighlights = await this.matchKeywords(
      achievements,
      input.jobDescription,
      userId
    );

    // Step 3: Generate introduction
    const introduction = await this.generateIntroduction(
      matchedHighlights,
      input.style,
      input.duration,
      userId
    );

    // Step 4: Calculate keyword overlap
    const keywordOverlap = this.calculateKeywordOverlap(
      introduction,
      input.jobDescription
    );

    // Step 5: Generate suggestions
    const suggestions = await this.generateSuggestions(
      introduction,
      keywordOverlap,
      userId
    );

    return {
      introduction,
      highlights: matchedHighlights,
      keywordOverlap,
      suggestions,
    };
  }

  /**
   * Extract STAR achievements from resume
   * Uses cost-optimized model for extraction
   * Validates: Requirements 2.1, 2.2
   */
  async extractSTARachievements(
    resumeData: ParsedResumeData,
    userId: string
  ): Promise<STARAchievement[]> {
    this.logger.debug('Extracting STAR achievements from resume');

    const achievements: STARAchievement[] = [];

    // Extract from work experience
    for (const exp of resumeData.experience) {
      if (exp.achievements && exp.achievements.length > 0) {
        for (const achievement of exp.achievements) {
          const starAchievement = await this.parseSTARFormat(
            achievement,
            exp.company,
            exp.position,
            userId
          );
          achievements.push(starAchievement);
        }
      }
    }

    // Extract from projects
    for (const project of resumeData.projects) {
      if (project.highlights && project.highlights.length > 0) {
        for (const highlight of project.highlights) {
          const starAchievement = await this.parseSTARFormat(
            highlight,
            project.name,
            'Project',
            userId
          );
          achievements.push(starAchievement);
        }
      }
    }

    this.logger.debug(`Extracted ${achievements.length} STAR achievements`);
    return achievements;
  }

  /**
   * Parse achievement into STAR format
   * Uses cost-optimized model
   */
  private async parseSTARFormat(
    achievement: string,
    context: string,
    role: string,
    userId: string
  ): Promise<STARAchievement> {
    const prompt = `Parse the following achievement into STAR format (Situation, Task, Action, Result). Return as JSON.

Context: ${context}
Role: ${role}
Achievement: ${achievement}

Return JSON with keys: situation, task, action, result`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 300,
      },
      userId,
      'pitch-perfect-star-extraction'
    );

    try {
      const parsed = JSON.parse(response.content);
      return {
        situation: parsed.situation || '',
        task: parsed.task || '',
        action: parsed.action || '',
        result: parsed.result || '',
        fullText: achievement,
      };
    } catch {
      // Fallback if parsing fails
      return {
        situation: context,
        task: role,
        action: achievement,
        result: '',
        fullText: achievement,
      };
    }
  }

  /**
   * Match achievements with JD keywords
   * Select top 3-5 highlights
   * Validates: Requirements 2.3
   */
  async matchKeywords(
    achievements: STARAchievement[],
    jobDescription: string,
    userId: string
  ): Promise<string[]> {
    this.logger.debug('Matching achievements with JD keywords');

    if (achievements.length === 0) {
      return [];
    }

    const achievementTexts = achievements.map((a) => a.fullText).join('\n');

    const prompt = `Given the following job description and achievements, identify the top 3-5 most relevant achievements that best match the job requirements.

Job Description:
${jobDescription}

Achievements:
${achievementTexts}

Return a JSON array with exactly 3-5 selected achievements (or fewer if less than 3 are available). Format: ["achievement1", "achievement2", ...]`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 500,
      },
      userId,
      'pitch-perfect-keyword-matching'
    );

    try {
      const matched = JSON.parse(response.content);
      return Array.isArray(matched) ? matched.slice(0, 5) : [];
    } catch {
      // Fallback: return first 3 achievements
      return achievements.slice(0, 3).map((a) => a.fullText);
    }
  }

  /**
   * Generate introduction in specified style and duration
   * Uses quality-optimized model
   * Validates: Requirements 2.4, 2.5
   */
  async generateIntroduction(
    highlights: string[],
    style: 'technical' | 'managerial' | 'sales',
    duration: 30 | 60,
    userId: string
  ): Promise<string> {
    this.logger.debug(
      `Generating ${duration}s introduction with ${style} style`
    );

    const styleGuide = this.getStyleGuide(style);
    const wordCount = duration === 30 ? 75 : 150; // Approximate words for duration

    const prompt = `Create a professional personal introduction for an interview.

Duration: ${duration} seconds (approximately ${wordCount} words)
Style: ${style}
${styleGuide}

Key Achievements to Highlight:
${highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Generate a compelling, natural-sounding introduction that:
- Opens with a strong hook
- Highlights the key achievements
- Maintains the specified style
- Fits within the time duration
- Ends with a forward-looking statement`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 300,
      },
      userId,
      'pitch-perfect-generation'
    );

    return response.content.trim();
  }

  /**
   * Get style-specific guidance
   */
  private getStyleGuide(style: 'technical' | 'managerial' | 'sales'): string {
    const guides = {
      technical:
        'Focus on technical skills, technologies, and problem-solving achievements. Use precise language and specific metrics.',
      managerial:
        'Emphasize leadership, team management, and strategic achievements. Highlight impact on business outcomes.',
      sales:
        'Focus on relationship-building, revenue impact, and customer success. Use persuasive and engaging language.',
    };
    return guides[style];
  }

  /**
   * Calculate keyword overlap between introduction and JD
   * Validates: Requirements 2.6
   */
  calculateKeywordOverlap(
    introduction: string,
    jobDescription: string
  ): {
    matched: string[];
    missing: string[];
    overlapPercentage: number;
  } {
    this.logger.debug('Calculating keyword overlap');

    // Extract keywords from both texts
    const introKeywords = this.extractKeywords(introduction);
    const jdKeywords = this.extractKeywords(jobDescription);

    // Find matched keywords
    const matched = Array.from(introKeywords).filter((kw) =>
      jdKeywords.has(kw)
    );

    // Find missing keywords
    const missing = Array.from(jdKeywords).filter(
      (kw) => !introKeywords.has(kw)
    );

    // Calculate overlap percentage
    const overlapPercentage =
      jdKeywords.size > 0 ? (matched.length / jdKeywords.size) * 100 : 0;

    return {
      matched,
      missing: missing.slice(0, 10), // Limit to top 10 missing keywords
      overlapPercentage: Math.round(overlapPercentage * 10) / 10,
    };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    // Simple keyword extraction: split by whitespace and filter
    const keywords = new Set<string>();
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Filter out common stop words
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'with',
      'that',
      'this',
      'from',
      'have',
      'been',
      'were',
      'will',
      'your',
      'their',
      'about',
      'which',
      'would',
      'could',
      'should',
    ]);

    for (const word of words) {
      if (!stopWords.has(word) && word.length > 3) {
        keywords.add(word);
      }
    }

    return keywords;
  }

  /**
   * Generate suggestions for improvement
   */
  private async generateSuggestions(
    introduction: string,
    keywordOverlap: {
      matched: string[];
      missing: string[];
      overlapPercentage: number;
    },
    _userId: string
  ): Promise<string[]> {
    this.logger.debug('Generating improvement suggestions');

    const suggestions: string[] = [];

    // Suggestion 1: Keyword coverage
    if (keywordOverlap.overlapPercentage < 50) {
      suggestions.push(
        `Consider incorporating more keywords from the job description. Current coverage: ${keywordOverlap.overlapPercentage}%`
      );
    }

    // Suggestion 2: Missing keywords
    if (keywordOverlap.missing.length > 0) {
      const topMissing = keywordOverlap.missing.slice(0, 3).join(', ');
      suggestions.push(
        `Try to include these important keywords: ${topMissing}`
      );
    }

    // Suggestion 3: Length check
    const wordCount = introduction.split(/\s+/).length;
    if (wordCount < 50) {
      suggestions.push(
        'Consider expanding your introduction with more details'
      );
    } else if (wordCount > 200) {
      suggestions.push(
        'Consider condensing your introduction to be more concise'
      );
    }

    return suggestions;
  }

  /**
   * Refine introduction based on user feedback
   * Validates: Requirements 2.7
   */
  async refineIntroduction(
    currentIntroduction: string,
    feedback: string,
    userId: string
  ): Promise<string> {
    this.logger.debug('Refining introduction based on feedback');

    const prompt = `Refine the following introduction based on the user's feedback.

Current Introduction:
${currentIntroduction}

User Feedback:
${feedback}

Generate an improved version that addresses the feedback while maintaining professionalism and impact.`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 300,
      },
      userId,
      'pitch-perfect-refinement'
    );

    return response.content.trim();
  }
}
