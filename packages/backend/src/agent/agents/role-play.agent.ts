import { Injectable, Logger } from '@nestjs/common';
import { AIEngineService } from '../../ai-providers/ai-engine.service';
import { RedisService } from '../../redis/redis.service';
import { PerformanceMonitorService } from '../../ai-providers/monitoring/performance-monitor.service';
import {
  ContextCompressorService,
  Message,
} from '../services/context-compressor.service';
import { ParsedResumeData } from '../../types';

/**
 * Interview feedback structure
 */
export interface InterviewFeedback {
  sessionId: string;
  overallScore: number;
  scores: {
    clarity: number;
    relevance: number;
    depth: number;
    communication: number;
    technicalAccuracy: number;
  };
  strengths: string[];
  improvementAreas: string[];
  radarChartData: Array<{
    category: string;
    score: number;
  }>;
  keyTakeaways: string[];
}

/**
 * Real-time analysis result
 */
export interface RealTimeAnalysis {
  keywords: string[];
  sentiment: string;
  suggestions: string[];
  relevanceScore: number;
}

/**
 * Interview state
 */
export interface RolePlayAgentState {
  sessionId: string;
  conversationHistory: Message[];
  currentQuestion: string;
  askedQuestions: string[];
  userPerformance: {
    clarity: number;
    relevance: number;
    depth: number;
    communication: number;
    technicalAccuracy: number;
  };
  interviewerPersona: string;
  interviewerStyle: 'strict' | 'friendly' | 'stress-test';
}

/**
 * Interview configuration
 */
export interface RolePlayAgentConfig {
  jobDescription: string;
  interviewerStyle: 'strict' | 'friendly' | 'stress-test';
  focusAreas: string[];
  resumeData?: ParsedResumeData;
}

/**
 * Role-Play Agent
 * Provides high-fidelity mock interview simulation with real-time feedback
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
@Injectable()
export class RolePlayAgent {
  private readonly logger = new Logger(RolePlayAgent.name);
  private readonly COMPRESSION_THRESHOLD = 2000; // tokens
  private readonly SESSION_TTL = 3600; // 1 hour in seconds

  constructor(
    private aiEngineService: AIEngineService,
    private redisService: RedisService,
    private performanceMonitor: PerformanceMonitorService,
    private contextCompressor: ContextCompressorService
  ) {}

  /**
   * Start a new mock interview session
   * Initialize interviewer persona based on JD
   * Support different styles (strict, friendly, stress-test)
   * Generate opening question
   * Validates: Requirements 4.1, 4.2
   */
  async startInterview(
    config: RolePlayAgentConfig,
    userId: string
  ): Promise<RolePlayAgentState> {
    this.logger.log(
      `Starting interview for user ${userId} with style ${config.interviewerStyle}`
    );

    const sessionId = this.generateSessionId();

    // Initialize interviewer persona
    const persona = await this.initializePersona(config, userId);

    // Store persona in Redis
    await this.redisService.set(
      `interview:${sessionId}:persona`,
      JSON.stringify(persona),
      this.SESSION_TTL
    );

    // Generate opening question
    const openingQuestion = await this.generateOpeningQuestion(
      config,
      persona,
      userId
    );

    // Initialize conversation history
    const initialHistory: Message[] = [
      {
        role: 'system',
        content: `Interviewer Persona: ${persona}`,
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: openingQuestion,
        timestamp: new Date(),
      },
    ];

    // Store initial history in Redis
    await this.redisService.set(
      `interview:${sessionId}:history`,
      JSON.stringify(initialHistory),
      this.SESSION_TTL
    );

    // Initialize performance tracking
    const initialPerformance = {
      clarity: 0,
      relevance: 0,
      depth: 0,
      communication: 0,
      technicalAccuracy: 0,
    };

    await this.redisService.set(
      `interview:${sessionId}:performance`,
      JSON.stringify(initialPerformance),
      this.SESSION_TTL
    );

    this.logger.debug(`Interview session ${sessionId} started`);

    return {
      sessionId,
      conversationHistory: initialHistory,
      currentQuestion: openingQuestion,
      askedQuestions: [openingQuestion],
      userPerformance: initialPerformance,
      interviewerPersona: persona,
      interviewerStyle: config.interviewerStyle,
    };
  }

  /**
   * Process user response and generate follow-up
   * Analyze response in real-time
   * Generate contextual follow-up
   * Update conversation history
   * Validates: Requirements 4.4, 4.5
   */
  async processUserResponse(
    sessionId: string,
    userResponse: string,
    userId: string
  ): Promise<{
    followUpQuestion: string;
    realTimeAnalysis: RealTimeAnalysis;
  }> {
    this.logger.debug(`Processing user response for session ${sessionId}`);

    // Step 1: Load conversation history (with compression if needed)
    const { history, compressed } = await this.loadCompressedHistory(sessionId);

    // Step 2: Analyze user response in real-time
    const analysis = await this.analyzeResponse(userResponse, userId);

    // Step 3: Update performance metrics
    await this.updatePerformanceMetrics(sessionId, analysis);

    // Step 4: Generate follow-up question based on response
    const followUpQuestion = await this.generateFollowUp(
      history,
      userResponse,
      analysis,
      userId
    );

    // Step 5: Update conversation history
    await this.updateHistory(sessionId, userResponse, followUpQuestion);

    this.logger.debug(
      `Generated follow-up question for session ${sessionId}${compressed ? ' (with compression)' : ''}`
    );

    return {
      followUpQuestion,
      realTimeAnalysis: analysis,
    };
  }

  /**
   * Analyze user response
   * Evaluate keywords, logic, speech patterns
   * Provide real-time suggestions
   * Validates: Requirements 4.5
   */
  async analyzeResponse(
    userResponse: string,
    userId: string
  ): Promise<RealTimeAnalysis> {
    this.logger.debug('Analyzing user response');

    const prompt = `Analyze the following interview response and provide feedback.

Response: "${userResponse}"

Provide analysis in JSON format with:
- keywords: array of key technical/domain keywords found
- sentiment: overall sentiment (positive/neutral/negative)
- suggestions: array of 2-3 improvement suggestions
- relevanceScore: 0-100 score for how relevant the response is

Return JSON only.`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 400,
      },
      userId,
      'role-play-analysis'
    );

    try {
      const parsed = JSON.parse(response.content);
      return {
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        sentiment: parsed.sentiment || 'neutral',
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
        relevanceScore: Math.min(100, Math.max(0, parsed.relevanceScore || 50)),
      };
    } catch {
      // Fallback analysis
      return {
        keywords: this.extractKeywords(userResponse),
        sentiment: 'neutral',
        suggestions: [
          'Provide more specific examples',
          'Include measurable outcomes',
        ],
        relevanceScore: 50,
      };
    }
  }

  /**
   * Conclude interview and generate feedback
   * Generate structured feedback
   * Calculate scores for criteria
   * Create radar chart data
   * Identify improvement areas
   * Validates: Requirements 4.6, 4.7
   */
  async concludeInterview(
    sessionId: string,
    userId: string
  ): Promise<InterviewFeedback> {
    this.logger.log(`Concluding interview session ${sessionId}`);

    // Load full conversation history
    const history = await this.loadFullHistory(sessionId);

    // Load performance metrics
    const performanceStr = await this.redisService.get(
      `interview:${sessionId}:performance`
    );
    const performance = performanceStr ? JSON.parse(performanceStr) : {};

    // Generate structured feedback
    const feedback = await this.generateFeedback(history, performance, userId);

    // Store feedback in Redis for later retrieval
    await this.redisService.set(
      `interview:${sessionId}:feedback`,
      JSON.stringify(feedback),
      this.SESSION_TTL
    );

    this.logger.debug(`Interview feedback generated for session ${sessionId}`);

    return feedback;
  }

  /**
   * Load conversation history with compression if needed
   */
  private async loadCompressedHistory(
    sessionId: string
  ): Promise<{ history: Message[]; compressed: boolean }> {
    const historyStr = await this.redisService.get(
      `interview:${sessionId}:history`
    );
    const history: Message[] = historyStr ? JSON.parse(historyStr) : [];

    // Check if compression is needed
    const shouldCompress = this.contextCompressor.shouldCompress(history);

    if (shouldCompress) {
      this.logger.debug(`Compressing history for session ${sessionId}`);
      const compressedMessages =
        await this.contextCompressor.compressWithSlidingWindow(history, 5, 500);

      // Update stored history
      await this.redisService.set(
        `interview:${sessionId}:history`,
        JSON.stringify(compressedMessages),
        this.SESSION_TTL
      );

      return { history: compressedMessages, compressed: true };
    }

    return { history, compressed: false };
  }

  /**
   * Load full conversation history
   */
  private async loadFullHistory(sessionId: string): Promise<Message[]> {
    const historyStr = await this.redisService.get(
      `interview:${sessionId}:history`
    );
    return historyStr ? JSON.parse(historyStr) : [];
  }

  /**
   * Update conversation history with new messages
   */
  private async updateHistory(
    sessionId: string,
    userResponse: string,
    followUpQuestion: string
  ): Promise<void> {
    const historyStr = await this.redisService.get(
      `interview:${sessionId}:history`
    );
    const history: Message[] = historyStr ? JSON.parse(historyStr) : [];

    // Add user response
    history.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date(),
    });

    // Add follow-up question
    history.push({
      role: 'assistant',
      content: followUpQuestion,
      timestamp: new Date(),
    });

    // Store updated history
    await this.redisService.set(
      `interview:${sessionId}:history`,
      JSON.stringify(history),
      this.SESSION_TTL
    );
  }

  /**
   * Update performance metrics based on analysis
   */
  private async updatePerformanceMetrics(
    sessionId: string,
    analysis: RealTimeAnalysis
  ): Promise<void> {
    const performanceStr = await this.redisService.get(
      `interview:${sessionId}:performance`
    );
    const performance = performanceStr ? JSON.parse(performanceStr) : {};

    // Update metrics based on analysis
    const relevanceScore = analysis.relevanceScore;

    // Increment counters (simple moving average)
    performance.clarity =
      (performance.clarity || 0) * 0.7 + relevanceScore * 0.3;
    performance.relevance =
      (performance.relevance || 0) * 0.7 + relevanceScore * 0.3;
    performance.depth =
      (performance.depth || 0) * 0.7 + analysis.keywords.length * 10 * 0.3;
    performance.communication =
      (performance.communication || 0) * 0.7 + relevanceScore * 0.3;
    performance.technicalAccuracy =
      (performance.technicalAccuracy || 0) * 0.7 +
      (analysis.keywords.length > 0 ? 70 : 30) * 0.3;

    // Store updated performance
    await this.redisService.set(
      `interview:${sessionId}:performance`,
      JSON.stringify(performance),
      this.SESSION_TTL
    );
  }

  /**
   * Initialize interviewer persona based on JD and style
   */
  private async initializePersona(
    config: RolePlayAgentConfig,
    userId: string
  ): Promise<string> {
    const styleGuides = {
      strict:
        'You are a strict, no-nonsense interviewer who expects precise, well-thought-out answers. You probe deeply and challenge candidates.',
      friendly:
        'You are a friendly, approachable interviewer who makes candidates comfortable. You encourage them to share experiences and ask follow-up questions.',
      'stress-test':
        'You are a challenging interviewer who tests candidates under pressure. You ask difficult questions and push for detailed explanations.',
    };

    const prompt = `Create an interviewer persona for a ${config.interviewerStyle} interview style.

Job Description:
${config.jobDescription}

Focus Areas: ${config.focusAreas.join(', ')}

Style Guide: ${styleGuides[config.interviewerStyle]}

Generate a brief persona description (2-3 sentences) that describes the interviewer's approach, tone, and focus areas.`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 200,
      },
      userId,
      'role-play-persona'
    );

    return response.content.trim();
  }

  /**
   * Generate opening question
   */
  private async generateOpeningQuestion(
    config: RolePlayAgentConfig,
    persona: string,
    userId: string
  ): Promise<string> {
    const prompt = `As an interviewer with the following persona, generate an opening question for a mock interview.

Persona: ${persona}

Job Description:
${config.jobDescription}

Focus Areas: ${config.focusAreas.join(', ')}

Generate a single, engaging opening question that sets the tone for the interview. The question should be open-ended and encourage the candidate to share relevant experience.`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 200,
      },
      userId,
      'role-play-opening'
    );

    return response.content.trim();
  }

  /**
   * Generate follow-up question based on user response
   */
  private async generateFollowUp(
    history: Message[],
    userResponse: string,
    analysis: RealTimeAnalysis,
    userId: string
  ): Promise<string> {
    const historyText = history
      .slice(-4) // Last 4 messages for context
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `Based on the interview conversation and the candidate's response, generate a contextual follow-up question.

Recent Conversation:
${historyText}

Candidate's Latest Response: "${userResponse}"

Analysis:
- Keywords mentioned: ${analysis.keywords.join(', ') || 'none'}
- Sentiment: ${analysis.sentiment}
- Relevance Score: ${analysis.relevanceScore}/100

Generate a follow-up question that:
1. References or builds upon the candidate's response
2. Probes deeper into their experience or knowledge
3. Maintains a natural conversation flow`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 200,
      },
      userId,
      'role-play-followup'
    );

    return response.content.trim();
  }

  /**
   * Generate structured feedback
   */
  private async generateFeedback(
    history: Message[],
    performance: Record<string, number>,
    userId: string
  ): Promise<InterviewFeedback> {
    const sessionId = this.generateSessionId();
    const conversationText = history
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `Analyze the following mock interview and provide structured feedback.

Interview Conversation:
${conversationText}

Generate feedback in JSON format with:
- overallScore: 0-100 overall performance score
- strengths: array of 2-3 key strengths
- improvementAreas: array of 2-3 areas for improvement
- keyTakeaways: array of 2-3 key takeaways

Return JSON only.`;

    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt,
        maxTokens: 500,
      },
      userId,
      'role-play-feedback'
    );

    try {
      const parsed = JSON.parse(response.content);

      // Normalize performance scores to 0-100
      const normalizeScore = (score: number) =>
        Math.min(100, Math.max(0, score || 50));

      const scores = {
        clarity: normalizeScore(performance.clarity),
        relevance: normalizeScore(performance.relevance),
        depth: normalizeScore(performance.depth),
        communication: normalizeScore(performance.communication),
        technicalAccuracy: normalizeScore(performance.technicalAccuracy),
      };

      const overallScore =
        (scores.clarity +
          scores.relevance +
          scores.depth +
          scores.communication +
          scores.technicalAccuracy) /
        5;

      return {
        sessionId,
        overallScore: Math.round(overallScore),
        scores,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        improvementAreas: Array.isArray(parsed.improvementAreas)
          ? parsed.improvementAreas
          : [],
        radarChartData: [
          { category: 'Clarity', score: scores.clarity },
          { category: 'Relevance', score: scores.relevance },
          { category: 'Depth', score: scores.depth },
          { category: 'Communication', score: scores.communication },
          {
            category: 'Technical Accuracy',
            score: scores.technicalAccuracy,
          },
        ],
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways
          : [],
      };
    } catch {
      // Fallback feedback
      return {
        sessionId,
        overallScore: 65,
        scores: {
          clarity: 65,
          relevance: 65,
          depth: 65,
          communication: 65,
          technicalAccuracy: 65,
        },
        strengths: ['Good communication', 'Relevant experience'],
        improvementAreas: [
          'Provide more specific examples',
          'Go deeper into technical details',
        ],
        radarChartData: [
          { category: 'Clarity', score: 65 },
          { category: 'Relevance', score: 65 },
          { category: 'Depth', score: 65 },
          { category: 'Communication', score: 65 },
          { category: 'Technical Accuracy', score: 65 },
        ],
        keyTakeaways: [
          'Strong overall performance',
          'Focus on technical depth',
        ],
      };
    }
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
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
    ]);

    return words.filter((w) => !stopWords.has(w) && w.length > 3).slice(0, 5);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
