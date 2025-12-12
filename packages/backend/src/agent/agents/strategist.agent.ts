import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { RAGService, InterviewQuestion } from '../services/rag.service';
import { UsageTrackerService } from '../../ai-providers/tracking/usage-tracker.service';
import { ParsedResumeData } from '../../types';

/**
 * Input interface for Strategist Agent
 */
export interface StrategistAgentInput {
  resumeData: ParsedResumeData;
  jobDescription: string;
  experienceLevel: 'junior' | 'mid' | 'senior';
}

/**
 * Interview question with metadata
 */
export interface InterviewQuestionWithMetadata extends InterviewQuestion {
  priority: 'must-prepare' | 'important' | 'optional';
  difficulty: 'easy' | 'medium' | 'hard';
  source: 'custom' | 'knowledge-base';
}

/**
 * Output interface for Strategist Agent
 */
export interface StrategistAgentOutput {
  questions: InterviewQuestionWithMetadata[];
  categorization: {
    technical: number;
    behavioral: number;
    scenario: number;
  };
  totalQuestions: number;
  focusAreas: string[];
}

/**
 * Context analysis result
 */
interface ContextAnalysis {
  keywords: string[];
  focusAreas: string[];
  experienceLevel: 'junior' | 'mid' | 'senior';
  relevantSkills: string[];
}

/**
 * Interview performance data
 */
export interface InterviewPerformance {
  sessionId: string;
  weakAreas: string[];
  strongAreas: string[];
  overallScore: number;
  questionResponses: Array<{
    questionId: string;
    question: string;
    userResponse: string;
    score: number;
    feedback: string;
  }>;
}

/**
 * Strategist Agent
 * Builds customized interview question banks based on user background and target position
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
@Injectable()
export class StrategistAgent {
  private readonly logger = new Logger(StrategistAgent.name);

  constructor(
    private aiEngineService: AIEngineService,
    private ragService: RAGService,
    private usageTracker: UsageTrackerService
  ) {}

  /**
   * Build customized question bank
   * Main entry point for the agent
   * Validates: Requirements 3.1-3.7
   */
  async buildQuestionBank(
    input: StrategistAgentInput,
    userId: string
  ): Promise<StrategistAgentOutput> {
    this.logger.log(
      `Building question bank for user ${userId} with experience level ${input.experienceLevel}`
    );

    // Step 1: Analyze context
    const analysis = await this.analyzeContext(input, userId);

    // Step 2: Retrieve common questions from knowledge base
    const commonQuestions = await this.retrieveCommonQuestions(
      analysis.keywords,
      input.experienceLevel,
      userId
    );

    // Step 3: Generate custom questions
    const customQuestions = await this.generateCustomQuestions(
      input,
      analysis,
      userId
    );

    // Step 4: Combine and prioritize questions
    const allQuestions = [...commonQuestions, ...customQuestions];
    const prioritized = await this.prioritizeQuestions(
      allQuestions,
      input,
      analysis,
      userId
    );

    // Step 5: Categorize questions
    const categorization = this.categorizeQuestions(prioritized);

    return {
      questions: prioritized,
      categorization,
      totalQuestions: prioritized.length,
      focusAreas: analysis.focusAreas,
    };
  }

  /**
   * Analyze context from resume and JD
   * Extract keywords and determine focus areas
   * Uses cost-optimized model
   * Validates: Requirements 3.1, 5.3
   */
  async analyzeContext(
    input: StrategistAgentInput,
    userId: string
  ): Promise<ContextAnalysis> {
    this.logger.debug('Analyzing context from resume and JD');

    // Extract keywords from resume
    const resumeKeywords = this.extractKeywordsFromResume(input.resumeData);

    // Extract keywords from JD
    const jdKeywords = this.extractKeywordsFromText(input.jobDescription);

    // Find common keywords (focus areas)
    const focusAreas = Array.from(resumeKeywords).filter((kw) =>
      jdKeywords.has(kw)
    );

    // Extract relevant skills from resume
    const relevantSkills = input.resumeData.skills.slice(0, 10);

    // Use LLM to identify key focus areas
    const prompt = `Based on the following resume and job description, identify the top 3-5 key focus areas for interview preparation.

Resume Skills: ${input.resumeData.skills.join(', ')}
Experience: ${input.resumeData.experience.map((e) => e.position).join(', ')}

Job Description:
${input.jobDescription}

Return a JSON array with 3-5 focus areas. Format: ["area1", "area2", ...]`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 200,
      },
      userId,
      'strategist-context-analysis'
    );

    let analyzedFocusAreas: string[] = [];
    try {
      analyzedFocusAreas = JSON.parse(response.content);
      if (!Array.isArray(analyzedFocusAreas)) {
        analyzedFocusAreas = focusAreas.slice(0, 5);
      }
    } catch {
      analyzedFocusAreas = focusAreas.slice(0, 5);
    }

    return {
      keywords: Array.from(jdKeywords),
      focusAreas: analyzedFocusAreas,
      experienceLevel: input.experienceLevel,
      relevantSkills,
    };
  }

  /**
   * Retrieve common questions from knowledge base
   * Uses RAG to fetch from knowledge base
   * Filter by experience level
   * Validates: Requirements 3.5
   */
  async retrieveCommonQuestions(
    keywords: string[],
    experienceLevel: 'junior' | 'mid' | 'senior',
    _userId: string
  ): Promise<InterviewQuestionWithMetadata[]> {
    this.logger.debug(
      `Retrieving common questions for keywords: ${keywords.slice(0, 3).join(', ')}`
    );

    try {
      // Use RAG to retrieve questions
      const questions = await this.ragService.retrieveQuestions(
        keywords,
        experienceLevel,
        10
      );

      // Convert to metadata format
      const withMetadata: InterviewQuestionWithMetadata[] = questions.map(
        (q) => ({
          ...q,
          priority: 'important' as const,
          source: 'knowledge-base' as const,
        })
      );

      this.logger.debug(
        `Retrieved ${withMetadata.length} common questions from knowledge base`
      );

      return withMetadata;
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve common questions: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Generate custom questions
   * Uses quality-optimized model
   * Limit to 5 questions to save tokens
   * Personalize to user background
   * Validates: Requirements 3.4
   */
  async generateCustomQuestions(
    input: StrategistAgentInput,
    analysis: ContextAnalysis,
    userId: string
  ): Promise<InterviewQuestionWithMetadata[]> {
    this.logger.debug('Generating custom questions');

    const focusAreasText = analysis.focusAreas.join(', ');
    const skillsText = analysis.relevantSkills.join(', ');

    const prompt = `Generate 5 highly personalized interview questions for a ${input.experienceLevel} level candidate.

Focus Areas: ${focusAreasText}
Key Skills: ${skillsText}
Experience: ${input.resumeData.experience.map((e) => e.position).join(', ')}

Job Description:
${input.jobDescription}

Generate questions that:
1. Are specific to the candidate's background
2. Test knowledge in the focus areas
3. Are appropriate for ${input.experienceLevel} level
4. Mix technical, behavioral, and scenario-based questions

Return a JSON array of objects with: question, difficulty (easy/medium/hard), type (technical/behavioral/scenario)
Format: [{"question": "...", "difficulty": "...", "type": "..."}, ...]`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 800,
      },
      userId,
      'strategist-custom-generation'
    );

    const customQuestions: InterviewQuestionWithMetadata[] = [];

    try {
      const parsed = JSON.parse(response.content);
      const questions = Array.isArray(parsed) ? parsed : [];

      for (const q of questions.slice(0, 5)) {
        customQuestions.push({
          question: q.question || '',
          difficulty: q.difficulty || 'medium',
          type: q.type || 'technical',
          priority: 'must-prepare' as const,
          source: 'custom' as const,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse custom questions: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.logger.debug(`Generated ${customQuestions.length} custom questions`);
    return customQuestions;
  }

  /**
   * Prioritize questions
   * Mark high-relevance as "must-prepare"
   * Assign difficulty levels
   * Categorize by type
   * Validates: Requirements 3.2, 3.3, 3.6
   */
  async prioritizeQuestions(
    questions: InterviewQuestionWithMetadata[],
    input: StrategistAgentInput,
    analysis: ContextAnalysis,
    _userId: string
  ): Promise<InterviewQuestionWithMetadata[]> {
    this.logger.debug(`Prioritizing ${questions.length} questions`);

    const prioritized: InterviewQuestionWithMetadata[] = [];

    for (const question of questions) {
      let priority: 'must-prepare' | 'important' | 'optional' = 'optional';

      // Determine priority based on relevance to focus areas
      const questionText = question.question.toLowerCase();
      const focusAreaMatches = analysis.focusAreas.filter((area) =>
        questionText.includes(area.toLowerCase())
      ).length;

      if (focusAreaMatches >= 2 || question.source === 'custom') {
        priority = 'must-prepare';
      } else if (focusAreaMatches === 1) {
        priority = 'important';
      }

      // Adjust difficulty based on experience level
      let difficulty = question.difficulty;
      if (input.experienceLevel === 'junior' && difficulty === 'hard') {
        difficulty = 'medium';
      } else if (input.experienceLevel === 'senior' && difficulty === 'easy') {
        difficulty = 'medium';
      }

      prioritized.push({
        ...question,
        priority,
        difficulty,
      });
    }

    // Sort by priority
    const priorityOrder = { 'must-prepare': 0, important: 1, optional: 2 };
    prioritized.sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        (a.difficulty === 'hard' ? -1 : 1)
    );

    this.logger.debug(
      `Prioritized questions: ${prioritized.filter((q) => q.priority === 'must-prepare').length} must-prepare, ${prioritized.filter((q) => q.priority === 'important').length} important`
    );

    return prioritized;
  }

  /**
   * Categorize questions by type
   */
  categorizeQuestions(questions: InterviewQuestionWithMetadata[]): {
    technical: number;
    behavioral: number;
    scenario: number;
  } {
    const categorization = {
      technical: 0,
      behavioral: 0,
      scenario: 0,
    };

    for (const question of questions) {
      if (question.type === 'technical') {
        categorization.technical++;
      } else if (question.type === 'behavioral') {
        categorization.behavioral++;
      } else if (question.type === 'scenario') {
        categorization.scenario++;
      }
    }

    return categorization;
  }

  /**
   * Update question bank based on interview performance
   * Analyze weak areas from interview
   * Add targeted questions
   * Validates: Requirements 3.7
   */
  async updateBasedOnPerformance(
    userId: string,
    currentQuestions: InterviewQuestionWithMetadata[],
    performance: InterviewPerformance
  ): Promise<InterviewQuestionWithMetadata[]> {
    this.logger.debug(
      `Updating question bank based on performance for user ${userId}`
    );

    // Identify weak areas
    const weakAreas = performance.weakAreas;

    if (weakAreas.length === 0) {
      return currentQuestions;
    }

    // Generate targeted questions for weak areas
    const prompt = `Generate 3-5 targeted interview questions to help improve performance in these weak areas: ${weakAreas.join(', ')}

These questions should:
1. Focus specifically on the weak areas
2. Help the candidate practice and improve
3. Be progressively challenging

Return a JSON array of objects with: question, difficulty (easy/medium/hard), type (technical/behavioral/scenario)
Format: [{"question": "...", "difficulty": "...", "type": "..."}, ...]`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 600,
      },
      userId,
      'strategist-performance-update'
    );

    const targetedQuestions: InterviewQuestionWithMetadata[] = [];

    try {
      const parsed = JSON.parse(response.content);
      const questions = Array.isArray(parsed) ? parsed : [];

      for (const q of questions.slice(0, 5)) {
        targetedQuestions.push({
          question: q.question || '',
          difficulty: q.difficulty || 'medium',
          type: q.type || 'technical',
          priority: 'must-prepare' as const,
          source: 'custom' as const,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse targeted questions: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Combine with existing questions, prioritizing targeted ones
    const updated = [
      ...targetedQuestions,
      ...currentQuestions.filter(
        (q) =>
          !weakAreas.some((area) =>
            q.question.toLowerCase().includes(area.toLowerCase())
          )
      ),
    ];

    this.logger.debug(
      `Updated question bank with ${targetedQuestions.length} targeted questions`
    );

    return updated;
  }

  /**
   * Extract keywords from resume
   */
  private extractKeywordsFromResume(resumeData: ParsedResumeData): Set<string> {
    const keywords = new Set<string>();

    // Add skills
    for (const skill of resumeData.skills) {
      keywords.add(skill.toLowerCase());
    }

    // Add positions
    for (const exp of resumeData.experience) {
      keywords.add(exp.position.toLowerCase());
    }

    // Add technologies from projects
    for (const project of resumeData.projects) {
      for (const tech of project.technologies) {
        keywords.add(tech.toLowerCase());
      }
    }

    return keywords;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywordsFromText(text: string): Set<string> {
    const keywords = new Set<string>();
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

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
      'must',
      'may',
      'can',
      'are',
      'you',
      'our',
      'we',
      'be',
      'to',
      'of',
      'in',
      'is',
      'at',
      'by',
      'or',
    ]);

    for (const word of words) {
      if (!stopWords.has(word) && word.length > 3) {
        keywords.add(word);
      }
    }

    return keywords;
  }
}
