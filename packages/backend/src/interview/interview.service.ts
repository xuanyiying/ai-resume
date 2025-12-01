import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AIEngine } from '@/ai';
import {
  InterviewQuestion,
  QuestionType,
  Difficulty,
  InterviewSession,
  InterviewMessage,
  InterviewStatus,
  MessageRole,
} from '@prisma/client';
import { ParsedJobData, ParsedResumeData } from '@/types';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EndSessionDto } from './dto/end-session.dto';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private prisma: PrismaService,
    private aiEngine: AIEngine
  ) { }

  /**
   * Generate interview questions based on resume and job
   * Creates 10-15 questions covering behavioral, technical, situational, and resume-based types
   * Implements STAR method for answer frameworks
   */
  async generateQuestions(
    optimizationId: string,
    userId: string,
    count: number = 12
  ): Promise<InterviewQuestion[]> {
    // Verify user owns the optimization
    const optimization = await this.prisma.optimization.findUnique({
      where: { id: optimizationId },
      include: {
        resume: true,
        job: true,
      },
    });

    if (!optimization) {
      throw new NotFoundException(
        `Optimization with ID ${optimizationId} not found`
      );
    }

    if (optimization.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this optimization'
      );
    }

    // Ensure count is between 10 and 15 (requirement 8.1)
    const questionCount = Math.max(10, Math.min(15, count));

    try {
      // Get resume and job data
      const resumeData = optimization.resume
        .parsedData as unknown as ParsedResumeData;
      const jobData = optimization.job
        .parsedRequirements as unknown as ParsedJobData;

      // Generate questions using AI engine
      let questions = await this.generateQuestionsWithAI(resumeData, jobData);

      // If AI generation fails or returns insufficient questions, use rule-based generation
      if (!questions || questions.length < questionCount) {
        questions = this.generateQuestionsWithRules(
          resumeData,
          jobData,
          questionCount
        );
      }

      // Ensure we have the right number of questions
      questions = questions.slice(0, questionCount);

      // Save questions to database
      const savedQuestions: InterviewQuestion[] = [];
      for (const question of questions) {
        const saved = await this.prisma.interviewQuestion.create({
          data: {
            optimizationId,
            questionType: question.questionType,
            question: question.question,
            suggestedAnswer: question.suggestedAnswer,
            tips: question.tips,
            difficulty: question.difficulty,
          },
        });
        savedQuestions.push(saved);
      }

      return savedQuestions;
    } catch (error) {
      this.logger.error('Error generating interview questions:', error);
      // Get resume and job data for fallback
      const resumeData = optimization.resume
        .parsedData as unknown as ParsedResumeData;
      const jobData = optimization.job
        .parsedRequirements as unknown as ParsedJobData;
      // Fall back to rule-based generation
      return this.generateQuestionsWithRulesAndSave(
        optimizationId,
        resumeData,
        jobData,
        questionCount
      );
    }
  }

  /**
   * Generate questions using AI engine
   */
  private async generateQuestionsWithAI(
    resumeData: ParsedResumeData,
    jobData: ParsedJobData
  ): Promise<Omit<InterviewQuestion, 'id' | 'createdAt' | 'optimizationId'>[]> {
    try {
      const jobDescription = JSON.stringify(jobData);
      const questions = await this.aiEngine.generateInterviewQuestions(
        resumeData,
        jobDescription
      );

      if (!Array.isArray(questions)) {
        return [];
      }

      // Convert AI response to InterviewQuestion format
      return questions.map((q: any) => ({
        questionType: this.mapQuestionType(q.questionType),
        question: q.question,
        suggestedAnswer: q.suggestedAnswer,
        tips: Array.isArray(q.tips) ? q.tips : [],
        difficulty: this.mapDifficulty(q.difficulty),
      }));
    } catch (error) {
      this.logger.warn('AI question generation failed:', error);
      return [];
    }
  }

  /**
   * Generate questions using rule-based approach
   */
  private generateQuestionsWithRules(
    resumeData: ParsedResumeData,
    jobData: ParsedJobData,
    count: number
  ): Omit<InterviewQuestion, 'id' | 'createdAt' | 'optimizationId'>[] {
    const questions: Omit<
      InterviewQuestion,
      'id' | 'createdAt' | 'optimizationId'
    >[] = [];

    // Generate behavioral questions (3-4)
    const behavioralCount = Math.ceil(count * 0.3);
    questions.push(
      ...this.generateBehavioralQuestions(resumeData, behavioralCount)
    );

    // Generate technical questions (3-4)
    const technicalCount = Math.ceil(count * 0.3);
    questions.push(...this.generateTechnicalQuestions(jobData, technicalCount));

    // Generate situational questions (2-3)
    const situationalCount = Math.ceil(count * 0.2);
    questions.push(
      ...this.generateSituationalQuestions(jobData, situationalCount)
    );

    // Generate resume-based questions (2-3)
    const resumeBasedCount = count - questions.length;
    questions.push(
      ...this.generateResumeBasedQuestions(resumeData, resumeBasedCount)
    );

    return questions.slice(0, count);
  }

  /**
   * Generate behavioral interview questions
   * Focus on past experiences and how candidate handled situations
   */
  private generateBehavioralQuestions(
    resumeData: ParsedResumeData,
    count: number
  ): Omit<InterviewQuestion, 'id' | 'createdAt' | 'optimizationId'>[] {
    const questions: Omit<
      InterviewQuestion,
      'id' | 'createdAt' | 'optimizationId'
    >[] = [];

    // Question 1: Tell me about a challenge you overcame
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.BEHAVIORAL,
        question:
          'Tell me about a time when you faced a significant challenge at work. How did you handle it?',
        suggestedAnswer: this.generateSTARAnswer(
          'Describe a specific challenge from your experience',
          'Explain what you needed to accomplish',
          'Detail the specific actions you took to overcome the challenge',
          'Share the positive outcome and what you learned'
        ),
        tips: [
          'Use the STAR method: Situation, Task, Action, Result',
          'Focus on your personal contribution',
          'Highlight problem-solving skills',
          'Mention measurable outcomes if possible',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 2: Describe a time you worked in a team
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.BEHAVIORAL,
        question:
          'Describe a time when you had to work with a difficult team member. How did you handle it?',
        suggestedAnswer: this.generateSTARAnswer(
          'Set the context of the team situation',
          'Explain the conflict or difficulty',
          'Describe how you communicated and resolved the issue',
          'Share the positive outcome and improved relationship'
        ),
        tips: [
          'Demonstrate emotional intelligence',
          'Show respect for different perspectives',
          'Focus on collaboration and communication',
          'Avoid blaming others',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 3: Tell me about your greatest achievement
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.BEHAVIORAL,
        question:
          'What is your greatest professional achievement? Why are you proud of it?',
        suggestedAnswer: this.generateSTARAnswer(
          'Describe the project or initiative',
          'Explain your role and responsibilities',
          'Detail the specific actions and strategies you used',
          'Highlight the impact and measurable results'
        ),
        tips: [
          'Choose an achievement relevant to the target role',
          'Quantify the impact (percentages, numbers, etc.)',
          'Show leadership and initiative',
          'Connect it to the job requirements',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 4: Describe a time you failed
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.BEHAVIORAL,
        question:
          'Tell me about a time when you failed or made a mistake. What did you learn from it?',
        suggestedAnswer: this.generateSTARAnswer(
          'Describe the situation and what went wrong',
          'Explain your responsibility in the failure',
          'Detail the steps you took to fix or learn from it',
          'Share how you applied the lesson to future situations'
        ),
        tips: [
          'Be honest and take responsibility',
          'Focus on learning and growth',
          'Show how you improved',
          'Avoid making excuses',
        ],
        difficulty: Difficulty.HARD,
      } as any);
    }

    return questions;
  }

  /**
   * Generate technical interview questions
   * Focus on skills and technical knowledge required for the role
   */
  private generateTechnicalQuestions(
    jobData: ParsedJobData,
    count: number
  ): Omit<InterviewQuestion, 'id' | 'createdAt' | 'optimizationId'>[] {
    const questions: Omit<
      InterviewQuestion,
      'id' | 'createdAt' | 'optimizationId'
    >[] = [];

    // Extract key technical skills from job requirements
    const topSkills = jobData.requiredSkills.slice(0, 3);

    // Question 1: Explain a key technology
    if (questions.length < count && topSkills.length > 0) {
      questions.push({
        questionType: QuestionType.TECHNICAL,
        question: `Explain your experience with ${topSkills[0]}. What projects have you used it in?`,
        suggestedAnswer: `Describe your hands-on experience with ${topSkills[0]}, including:
- Specific projects where you used it
- Key features and capabilities you've worked with
- Challenges you've overcome
- Best practices you follow
- How it compares to alternatives`,
        tips: [
          `Be specific about your ${topSkills[0]} experience`,
          'Provide concrete examples from your projects',
          'Show depth of knowledge',
          'Discuss real-world applications',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 2: Design or architecture question
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.TECHNICAL,
        question:
          'How would you approach designing a solution for a complex problem in your area of expertise?',
        suggestedAnswer: `Outline your design approach:
- Understand requirements and constraints
- Identify key components and their interactions
- Consider scalability and performance
- Discuss trade-offs and design decisions
- Explain how you would test and validate the solution`,
        tips: [
          'Think out loud and explain your reasoning',
          'Consider multiple approaches',
          'Discuss trade-offs',
          'Show systems thinking',
        ],
        difficulty: Difficulty.HARD,
      } as any);
    }

    // Question 3: Problem-solving question
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.TECHNICAL,
        question:
          'Describe your approach to debugging a complex technical issue.',
        suggestedAnswer: `Explain your debugging methodology:
- Gather information about the problem
- Reproduce the issue consistently
- Form hypotheses about the root cause
- Test hypotheses systematically
- Implement and verify the fix
- Document the solution for future reference`,
        tips: [
          'Show systematic problem-solving approach',
          'Mention tools and techniques you use',
          'Discuss how you stay organized',
          'Emphasize communication with team members',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 4: Keep learning question
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.TECHNICAL,
        question:
          'How do you stay current with new technologies and industry trends?',
        suggestedAnswer: `Describe your learning strategy:
- Online courses and certifications you pursue
- Technical blogs and publications you follow
- Open source projects you contribute to
- Communities and conferences you participate in
- How you apply new knowledge to your work`,
        tips: [
          'Show genuine interest in learning',
          'Mention specific resources and communities',
          'Discuss how you balance learning with work',
          'Show initiative and self-motivation',
        ],
        difficulty: Difficulty.EASY,
      } as any);
    }

    return questions;
  }

  /**
   * Generate situational interview questions
   * Present hypothetical scenarios to assess decision-making
   */
  private generateSituationalQuestions(
    jobData: ParsedJobData,
    count: number
  ): Omit<InterviewQuestion, 'id' | 'createdAt' | 'optimizationId'>[] {
    const questions: Omit<
      InterviewQuestion,
      'id' | 'createdAt' | 'optimizationId'
    >[] = [];

    // Question 1: Tight deadline scenario
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.SITUATIONAL,
        question:
          'You have a tight deadline and discover a critical issue that will delay the project. What do you do?',
        suggestedAnswer: `Your approach should include:
- Immediately inform stakeholders about the issue
- Assess the severity and impact
- Propose solutions and timeline adjustments
- Collaborate with team to find alternatives
- Keep communication transparent throughout`,
        tips: [
          'Show responsibility and transparency',
          'Demonstrate problem-solving skills',
          'Emphasize communication',
          'Focus on solutions, not excuses',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 2: Conflicting priorities scenario
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.SITUATIONAL,
        question:
          'You receive conflicting priorities from two managers. How do you handle this?',
        suggestedAnswer: `Your approach should include:
- Seek clarification on business impact and urgency
- Communicate with both managers about the conflict
- Propose a prioritization based on business value
- Document the decision and reasoning
- Adjust as needed based on feedback`,
        tips: [
          'Show diplomatic communication skills',
          'Focus on business impact',
          'Demonstrate maturity in handling conflict',
          'Seek guidance when needed',
        ],
        difficulty: Difficulty.HARD,
      } as any);
    }

    // Question 3: Disagreement with approach scenario
    if (questions.length < count) {
      questions.push({
        questionType: QuestionType.SITUATIONAL,
        question:
          "You disagree with your manager's technical approach. How do you handle it?",
        suggestedAnswer: `Your approach should include:
- Understand their reasoning and perspective
- Prepare data and evidence for your alternative approach
- Request a discussion to share your concerns
- Listen to feedback and be open to being wrong
- Support the final decision once made`,
        tips: [
          'Show respect for authority',
          'Demonstrate critical thinking',
          'Use data to support your position',
          'Show flexibility and team spirit',
        ],
        difficulty: Difficulty.HARD,
      } as any);
    }

    return questions;
  }

  /**
   * Generate resume-based interview questions
   * Ask about specific items mentioned in the resume
   */
  private generateResumeBasedQuestions(
    resumeData: ParsedResumeData,
    count: number
  ): Omit<InterviewQuestion, 'id' | 'createdAt' | 'optimizationId'>[] {
    const questions: Omit<
      InterviewQuestion,
      'id' | 'createdAt' | 'optimizationId'
    >[] = [];

    // Question 1: About most recent role
    if (questions.length < count && resumeData.experience.length > 0) {
      const mostRecent = resumeData.experience[0];
      questions.push({
        questionType: QuestionType.RESUME_BASED,
        question: `Tell me more about your role as ${mostRecent.position} at ${mostRecent.company}. What were your key responsibilities?`,
        suggestedAnswer: `Provide details about your role:
- Overview of the company and team
- Your specific responsibilities and scope
- Key projects you led or contributed to
- Technologies and tools you used
- Impact and achievements in the role`,
        tips: [
          'Be specific and detailed',
          'Highlight your contributions',
          'Connect to the target role',
          'Show growth and learning',
        ],
        difficulty: Difficulty.EASY,
      } as any);
    }

    // Question 2: About skills listed
    if (questions.length < count && resumeData.skills.length > 0) {
      const topSkill = resumeData.skills[0];
      questions.push({
        questionType: QuestionType.RESUME_BASED,
        question: `I see you have ${topSkill} listed as a skill. Can you describe a project where you used it?`,
        suggestedAnswer: `Describe a specific project:
- Context and objectives of the project
- Your role and responsibilities
- How you applied ${topSkill}
- Challenges you faced
- Results and what you learned`,
        tips: [
          'Choose a relevant and impressive project',
          'Be specific about your contribution',
          'Show technical depth',
          'Connect to the job requirements',
        ],
        difficulty: Difficulty.MEDIUM,
      } as any);
    }

    // Question 3: About education
    if (questions.length < count && resumeData.education.length > 0) {
      const education = resumeData.education[0];
      questions.push({
        questionType: QuestionType.RESUME_BASED,
        question: `Tell me about your ${education.degree} in ${education.field} from ${education.institution}. How has it prepared you for this role?`,
        suggestedAnswer: `Discuss your education:
- Key courses and subjects you studied
- Relevant projects or research
- How it relates to the target role
- Skills and knowledge you gained
- How you've applied it in your career`,
        tips: [
          'Connect education to job requirements',
          "Show how you've applied learning",
          'Mention relevant coursework or projects',
          'Demonstrate continuous learning',
        ],
        difficulty: Difficulty.EASY,
      } as any);
    }

    return questions;
  }

  /**
   * Generate STAR method answer framework
   * Situation, Task, Action, Result
   */
  private generateSTARAnswer(
    situation: string,
    task: string,
    action: string,
    result: string
  ): string {
    return `Use the STAR method to structure your answer:

**Situation:** ${situation}

**Task:** ${task}

**Action:** ${action}

**Result:** ${result}

Remember to be specific with examples and quantify results when possible.`;
  }

  /**
   * Map question type string to enum
   */
  private mapQuestionType(type: string): QuestionType {
    const typeMap: Record<string, QuestionType> = {
      behavioral: QuestionType.BEHAVIORAL,
      technical: QuestionType.TECHNICAL,
      situational: QuestionType.SITUATIONAL,
      resume_based: QuestionType.RESUME_BASED,
    };

    return typeMap[type?.toLowerCase()] || QuestionType.BEHAVIORAL;
  }

  /**
   * Map difficulty string to enum
   */
  private mapDifficulty(difficulty: string): Difficulty {
    const difficultyMap: Record<string, Difficulty> = {
      easy: Difficulty.EASY,
      medium: Difficulty.MEDIUM,
      hard: Difficulty.HARD,
    };

    return difficultyMap[difficulty?.toLowerCase()] || Difficulty.MEDIUM;
  }

  /**
   * Generate questions with rules and save to database
   */
  private async generateQuestionsWithRulesAndSave(
    optimizationId: string,
    resumeData: ParsedResumeData,
    jobData: ParsedJobData,
    count: number
  ): Promise<InterviewQuestion[]> {
    const questions = this.generateQuestionsWithRules(
      resumeData,
      jobData,
      count
    );

    const savedQuestions: InterviewQuestion[] = [];
    for (const question of questions) {
      const saved = await this.prisma.interviewQuestion.create({
        data: {
          optimizationId,
          questionType: question.questionType,
          question: question.question,
          suggestedAnswer: question.suggestedAnswer,
          tips: question.tips,
          difficulty: question.difficulty,
        },
      });
      savedQuestions.push(saved);
    }

    return savedQuestions;
  }

  /**
   * Get interview questions for an optimization
   */
  async getQuestions(
    optimizationId: string,
    userId: string
  ): Promise<InterviewQuestion[]> {
    // Verify user owns the optimization
    const optimization = await this.prisma.optimization.findUnique({
      where: { id: optimizationId },
    });

    if (!optimization) {
      throw new NotFoundException(
        `Optimization with ID ${optimizationId} not found`
      );
    }

    if (optimization.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this optimization'
      );
    }

    return this.prisma.interviewQuestion.findMany({
      where: { optimizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Export interview preparation as PDF
   * Returns the content that can be rendered as PDF
   */
  async exportInterviewPrep(
    optimizationId: string,
    userId: string
  ): Promise<string> {
    // Get questions
    const questions = await this.getQuestions(optimizationId, userId);

    if (questions.length === 0) {
      throw new NotFoundException(
        'No interview questions found for this optimization'
      );
    }

    // Generate HTML content for PDF
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Interview Preparation Guide</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 20px; }
    .question { margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #007bff; }
    .question-text { font-weight: bold; color: #333; margin-bottom: 10px; }
    .answer { margin: 10px 0; }
    .tips { margin: 10px 0; padding: 10px; background: #e7f3ff; border-radius: 4px; }
    .tips-title { font-weight: bold; color: #0056b3; }
    .difficulty { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }
    .difficulty.easy { background: #d4edda; color: #155724; }
    .difficulty.medium { background: #fff3cd; color: #856404; }
    .difficulty.hard { background: #f8d7da; color: #721c24; }
    .type { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #e2e3e5; color: #383d41; }
  </style>
</head>
<body>
  <h1>Interview Preparation Guide</h1>
  <p>This guide contains interview questions and suggested answers to help you prepare for your interview.</p>
`;

    // Group questions by type
    const questionsByType = this.groupQuestionsByType(questions);

    for (const [type, typeQuestions] of Object.entries(questionsByType)) {
      html += `<h2>${this.formatQuestionType(type)} Questions (${typeQuestions.length})</h2>`;

      typeQuestions.forEach((q, index) => {
        html += `
  <div class="question">
    <div class="question-text">
      Q${index + 1}: ${this.escapeHtml(q.question)}
      <span class="type">${this.formatQuestionType(q.questionType)}</span>
      <span class="difficulty ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
    </div>
    <div class="answer">
      <strong>Suggested Answer:</strong>
      <p>${this.escapeHtml(q.suggestedAnswer).replace(/\n/g, '<br>')}</p>
    </div>
    ${q.tips && q.tips.length > 0
            ? `
    <div class="tips">
      <div class="tips-title">Tips:</div>
      <ul>
        ${q.tips.map((tip) => `<li>${this.escapeHtml(tip)}</li>`).join('')}
      </ul>
    </div>
    `
            : ''
          }
  </div>
`;
      });
    }

    html += `
</body>
</html>
`;

    return html;
  }

  /**
   * Start a new interview session
   */
  async startSession(
    userId: string,
    createSessionDto: CreateSessionDto
  ): Promise<InterviewSession> {
    const { optimizationId } = createSessionDto;

    // Verify user owns the optimization
    const optimization = await this.prisma.optimization.findUnique({
      where: { id: optimizationId },
      include: {
        resume: true,
        job: true,
      },
    });

    if (!optimization) {
      throw new NotFoundException(
        `Optimization with ID ${optimizationId} not found`
      );
    }

    if (optimization.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this optimization'
      );
    }

    // Create session
    return this.prisma.interviewSession.create({
      data: {
        userId,
        optimizationId,
        status: InterviewStatus.IN_PROGRESS,
      },
    });
  }

  /**
   * Handle user message in interview session
   */
  async handleMessage(
    userId: string,
    sessionId: string,
    sendMessageDto: SendMessageDto
  ): Promise<{
    userMessage: InterviewMessage;
    aiMessage: InterviewMessage;
  }> {
    const { content, audioUrl } = sendMessageDto;

    // Verify session exists and belongs to user
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        optimization: {
          include: {
            resume: true,
            job: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this session'
      );
    }

    if (session.status !== InterviewStatus.IN_PROGRESS) {
      throw new ForbiddenException('Interview session is not in progress');
    }

    // Save user message
    const userMessage = await this.prisma.interviewMessage.create({
      data: {
        sessionId,
        role: MessageRole.USER,
        content,
        audioUrl,
      },
    });

    // Generate AI response
    const resumeData = session.optimization.resume
      .parsedData as unknown as ParsedResumeData;
    const jobData = session.optimization.job
      .parsedRequirements as unknown as ParsedJobData;

    const context = `
You are an experienced interviewer conducting a job interview.
Candidate Name: ${resumeData.personalInfo.name}
Job Title: ${session.optimization.job.title}
Company: ${session.optimization.job.company}

Your goal is to assess the candidate's fit for the role based on their resume and the job description.
Be professional, encouraging, but thorough. Ask follow-up questions when appropriate.
Keep your responses concise (under 100 words) to maintain a natural conversation flow.
`;

    const history = session.messages.map((m) => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content,
    }));

    const aiResponse = await this.aiEngine.chatWithInterviewer(
      context,
      content,
      history
    );

    // Save AI message
    const aiMessage = await this.prisma.interviewMessage.create({
      data: {
        sessionId,
        role: MessageRole.ASSISTANT,
        content: aiResponse.content,
        audioUrl: aiResponse.audioUrl,
      },
    });

    return { userMessage, aiMessage };
  }

  /**
   * End interview session
   */
  async endSession(
    userId: string,
    endSessionDto: EndSessionDto
  ): Promise<InterviewSession> {
    const { sessionId } = endSessionDto;

    // Verify session exists and belongs to user
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this session'
      );
    }

    // Update status
    const completedSession = await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: InterviewStatus.COMPLETED,
        endTime: new Date(),
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        optimization: {
          include: {
            resume: true,
            job: true,
          },
        },
      },
    });

    // Generate feedback asynchronously
    this.generateFeedback(completedSession).catch((err) =>
      this.logger.error(
        `Failed to generate feedback for session ${sessionId}`,
        err
      )
    );

    return completedSession;
  }

  /**
   * Generate feedback for completed session
   */
  private async generateFeedback(session: any) {
    const resumeData = session.optimization.resume
      .parsedData as unknown as ParsedResumeData;
    const jobData = session.optimization.job
      .parsedRequirements as unknown as ParsedJobData;

    // Use session.optimization.job.title/company
    const jobTitle = session.optimization.job.title || 'Unknown Role';
    const company = session.optimization.job.company || 'Unknown Company';

    const transcript = session.messages
      .map((m: any) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `
You are an expert interview coach. Review the following interview transcript for a ${jobTitle} position at ${company}.
Candidate: ${resumeData.personalInfo.name}

Transcript:
${transcript}

Provide a comprehensive evaluation including:
1. Overall Score (0-100)
2. Key Strengths (bullet points)
3. Areas for Improvement (bullet points)
4. Detailed Feedback on specific answers

Format the output as JSON:
{
  "score": number,
  "feedback": "markdown string"
}
`;

    try {
      const result = await this.aiEngine.generate(prompt, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      // Parse JSON from result
      // Assuming result is a string that might contain JSON
      let parsedResult;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (e) {
        // Fallback if parsing fails
        parsedResult = {
          score: 70,
          feedback: result,
        };
      }

      await this.prisma.interviewSession.update({
        where: { id: session.id },
        data: {
          score: parsedResult.score,
          feedback: parsedResult.feedback,
        },
      });
    } catch (error) {
      this.logger.error('Error generating feedback:', error);
    }
  }

  /**
   * Get session details
   */
  async getSession(
    userId: string,
    sessionId: string
  ): Promise<InterviewSession> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this session'
      );
    }

    return session;
  }

  /**
   * Get active session for an optimization
   * Returns the most recent IN_PROGRESS session if exists
   */
  async getActiveSessionByOptimization(
    userId: string,
    optimizationId: string
  ): Promise<InterviewSession | null> {
    // Verify user owns the optimization
    const optimization = await this.prisma.optimization.findUnique({
      where: { id: optimizationId },
    });

    if (!optimization) {
      throw new NotFoundException(
        `Optimization with ID ${optimizationId} not found`
      );
    }

    if (optimization.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this optimization'
      );
    }

    // Find most recent IN_PROGRESS session
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        userId,
        optimizationId,
        status: InterviewStatus.IN_PROGRESS,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    return session;
  }

  /**
   * Group questions by type
   */
  private groupQuestionsByType(
    questions: InterviewQuestion[]
  ): Record<string, InterviewQuestion[]> {
    const grouped: Record<string, InterviewQuestion[]> = {};

    for (const question of questions) {
      if (!grouped[question.questionType]) {
        grouped[question.questionType] = [];
      }
      grouped[question.questionType].push(question);
    }

    return grouped;
  }

  /**
   * Format question type for display
   */
  private formatQuestionType(type: string): string {
    const typeMap: Record<string, string> = {
      BEHAVIORAL: 'Behavioral',
      TECHNICAL: 'Technical',
      SITUATIONAL: 'Situational',
      RESUME_BASED: 'Resume-Based',
    };

    return typeMap[type] || type;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
