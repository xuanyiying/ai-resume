# Design Document: LangChain Agent Integration

## Overview

本设计文档描述如何将 LangChain 框架和 Agent 功能整合到现有的面试辅导系统中。设计遵循以下核心原则：

1. **最小侵入性**：通过适配器模式整合 LangChain，保持现有 AIEngine 和 AIProvidersModule 的功能不变
2. **模块化设计**：创建独立的 AgentModule，清晰的模块边界和依赖关系
3. **复用现有基础设施**：充分利用现有的 ModelSelector、UsageTrackerService、PerformanceMonitorService 等服务
4. **渐进式增强**：在现有功能基础上逐步添加 Agent 能力，不影响现有业务流程

系统将实现三个核心 Agent：

- **Pitch Perfect Agent**：个人介绍优化
- **Strategist Agent**：题库构建
- **Role-Play Agent**：面试官模拟

同时通过智能任务分级、上下文压缩和缓存机制显著降低 Token 消耗。

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  (Existing Services: Resume, Interview, Optimization, etc.)     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ├──────────────────┬──────────────────────────┐
                     │                  │                          │
                     ▼                  ▼                          ▼
┌────────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    AIEngine (Existing) │  │  AgentModule (NEW)   │  │ AIProvidersModule    │
│  - File Parsing        │  │  - Agent Workflows   │  │  (Existing)          │
│  - Basic AI Calls      │  │  - LangChain         │  │  - Multi-Provider    │
│  - Backward Compat     │  │  - Tools & Memory    │  │  - Model Selection   │
└────────┬───────────────┘  └──────────┬───────────┘  │  - Cost Tracking     │
         │                             │              │  - Performance Mon   │
         │                             │              └──────────┬───────────┘
         │                             │                         │
         └─────────────────────────────┼─────────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │   AIEngineService        │
                        │   (Existing Core)        │
                        │  - Unified LLM Interface │
                        │  - Prompt Templates      │
                        │  - Usage Tracking        │
                        │  - Retry & Error         │
                        └──────────────────────────┘
```

### Agent Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AgentModule                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              LangChain Adapter Layer                      │  │
│  │  - CustomLLM (wraps AIEngineService)                      │  │
│  │  - CustomVectorStore (wraps Vector DB)                    │  │
│  │  - CustomMemory (wraps Redis)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Agent Implementations                     │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────┐ │  │
│  │  │ Pitch Perfect  │  │  Strategist    │  │  Role-Play  │ │  │
│  │  │     Agent      │  │     Agent      │  │    Agent    │ │  │
│  │  └────────────────┘  └────────────────┘  └─────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Agent Tools                            │  │
│  │  - Resume Parser Tool                                     │  │
│  │  - JD Analyzer Tool                                       │  │
│  │  - Keyword Matcher Tool                                   │  │
│  │  - RAG Retrieval Tool                                     │  │
│  │  - Context Compressor Tool                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Workflow Orchestrator                     │  │
│  │  - Sequential Chains                                      │  │
│  │  - Parallel Chains                                        │  │
│  │  - Conditional Routing                                    │  │
│  │  - Error Handling & Fallback                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. LangChain Adapter Layer

#### 1.1 CustomLLM (LangChain LLM Wrapper)

将现有的 AIEngineService 适配为 LangChain 兼容的 LLM 接口。

```typescript
import { LLM } from 'langchain/llms/base';
import { AIEngineService } from '../ai-providers/ai-engine.service';

export class CustomLLM extends LLM {
  constructor(
    private aiEngineService: AIEngineService,
    private userId: string,
    private scenario: string
  ) {
    super({});
  }

  _llmType(): string {
    return 'custom-ai-engine';
  }

  async _call(
    prompt: string,
    options?: this['ParsedCallOptions']
  ): Promise<string> {
    const response = await this.aiEngineService.call(
      {
        model: '', // Auto-selected by scenario
        prompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      },
      this.userId,
      this.scenario
    );

    return response.content;
  }
}
```

#### 1.2 CustomVectorStore (Vector Database Wrapper)

```typescript
import { VectorStore } from 'langchain/vectorstores/base';
import { Embeddings } from 'langchain/embeddings/base';

export class CustomVectorStore extends VectorStore {
  constructor(
    embeddings: Embeddings,
    private vectorDbService: VectorDbService
  ) {
    super(embeddings, {});
  }

  async addDocuments(documents: Document[]): Promise<void> {
    // Delegate to vector DB service
  }

  async similaritySearchWithScore(
    query: string,
    k: number
  ): Promise<[Document, number][]> {
    // Delegate to vector DB service
  }
}
```

#### 1.3 CustomMemory (Redis-backed Memory)

```typescript
import { BaseChatMemory } from 'langchain/memory';
import { RedisService } from '../redis/redis.service';

export class CustomMemory extends BaseChatMemory {
  constructor(
    private redisService: RedisService,
    private sessionId: string
  ) {
    super({});
  }

  async loadMemoryVariables(): Promise<Record<string, any>> {
    // Load from Redis
  }

  async saveContext(
    inputValues: Record<string, any>,
    outputValues: Record<string, any>
  ): Promise<void> {
    // Save to Redis with TTL
  }
}
```

### 2. Agent Implementations

#### 2.1 Pitch Perfect Agent

个人介绍优化 Agent，帮助用户生成针对特定职位的自我介绍。

```typescript
export interface PitchPerfectAgentInput {
  resumeData: ParsedResumeData;
  jobDescription: string;
  style: 'technical' | 'managerial' | 'sales';
  duration: 30 | 60; // seconds
}

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

export class PitchPerfectAgent {
  private chain: LLMChain;

  constructor(
    private aiEngineService: AIEngineService,
    private promptTemplateManager: PromptTemplateManager
  ) {
    this.initializeChain();
  }

  async generate(
    input: PitchPerfectAgentInput
  ): Promise<PitchPerfectAgentOutput> {
    // Step 1: Extract STAR achievements (using lightweight model)
    const achievements = await this.extractSTARachievements(input.resumeData);

    // Step 2: Match with JD keywords
    const matchedHighlights = await this.matchKeywords(
      achievements,
      input.jobDescription
    );

    // Step 3: Generate introduction (using quality-optimized model)
    const introduction = await this.generateIntroduction(
      matchedHighlights,
      input.style,
      input.duration
    );

    // Step 4: Calculate keyword overlap
    const keywordOverlap = this.calculateKeywordOverlap(
      introduction,
      input.jobDescription
    );

    return {
      introduction,
      highlights: matchedHighlights,
      keywordOverlap,
      suggestions: await this.generateSuggestions(introduction, keywordOverlap),
    };
  }
}
```

#### 2.2 Strategist Agent

题库构建 Agent，根据用户背景和目标职位生成定制化面试题库。

```typescript
export interface StrategistAgentInput {
  resumeData: ParsedResumeData;
  jobDescription: string;
  experienceLevel: 'junior' | 'mid' | 'senior';
}

export interface InterviewQuestionWithMetadata extends InterviewQuestion {
  priority: 'must-prepare' | 'important' | 'optional';
  difficulty: 'easy' | 'medium' | 'hard';
  source: 'custom' | 'knowledge-base';
}

export interface StrategistAgentOutput {
  questions: InterviewQuestionWithMetadata[];
  categorization: {
    technical: number;
    behavioral: number;
    scenario: number;
  };
}

export class StrategistAgent {
  constructor(
    private aiEngineService: AIEngineService,
    private ragService: RAGService,
    private usageTracker: UsageTrackerService
  ) {}

  async buildQuestionBank(
    input: StrategistAgentInput
  ): Promise<StrategistAgentOutput> {
    // Step 1: Analyze resume and JD (cost-optimized)
    const analysis = await this.analyzeContext(input);

    // Step 2: Retrieve common questions from knowledge base (RAG)
    const commonQuestions = await this.ragService.retrieveQuestions(
      analysis.keywords,
      input.experienceLevel
    );

    // Step 3: Generate custom questions (quality-optimized, limited calls)
    const customQuestions = await this.generateCustomQuestions(
      input,
      analysis,
      5 // Limit to 5 custom questions to save tokens
    );

    // Step 4: Prioritize and categorize
    const prioritized = await this.prioritizeQuestions(
      [...commonQuestions, ...customQuestions],
      input
    );

    return {
      questions: prioritized,
      categorization: this.categorizeQuestions(prioritized),
    };
  }

  async updateBasedOnPerformance(
    userId: string,
    sessionId: string,
    performance: InterviewPerformance
  ): Promise<InterviewQuestionWithMetadata[]> {
    // Dynamically adjust question bank based on user performance
  }
}
```

#### 2.3 Role-Play Agent

面试官模拟 Agent，提供高拟真度的模拟面试体验。

```typescript
export interface RolePlayAgentConfig {
  jobDescription: string;
  interviewerStyle: 'strict' | 'friendly' | 'stress-test';
  focusAreas: string[];
}

export interface RolePlayAgentState {
  sessionId: string;
  conversationHistory: Message[];
  currentQuestion: string;
  askedQuestions: string[];
  userPerformance: {
    clarity: number;
    relevance: number;
    depth: number;
  };
}

export class RolePlayAgent {
  private memory: CustomMemory;
  private contextCompressor: ContextCompressor;

  constructor(
    private aiEngineService: AIEngineService,
    private redisService: RedisService,
    private performanceMonitor: PerformanceMonitorService
  ) {}

  async startInterview(
    config: RolePlayAgentConfig
  ): Promise<RolePlayAgentState> {
    const sessionId = this.generateSessionId();

    // Initialize interviewer persona
    const persona = await this.initializePersona(config);

    // Store in Redis
    await this.redisService.set(
      `interview:${sessionId}:persona`,
      JSON.stringify(persona),
      3600 // 1 hour TTL
    );

    // Generate opening question
    const openingQuestion = await this.generateOpeningQuestion(config);

    return {
      sessionId,
      conversationHistory: [],
      currentQuestion: openingQuestion,
      askedQuestions: [openingQuestion],
      userPerformance: { clarity: 0, relevance: 0, depth: 0 },
    };
  }

  async processUserResponse(
    sessionId: string,
    userResponse: string
  ): Promise<{
    followUpQuestion: string;
    realTimeAnalysis: {
      keywords: string[];
      sentiment: string;
      suggestions: string[];
    };
  }> {
    // Step 1: Load conversation history (compressed)
    const compressedHistory = await this.loadCompressedHistory(sessionId);

    // Step 2: Analyze user response in real-time
    const analysis = await this.analyzeResponse(userResponse);

    // Step 3: Generate follow-up question based on response
    const followUpQuestion = await this.generateFollowUp(
      compressedHistory,
      userResponse,
      analysis
    );

    // Step 4: Update conversation history (with compression)
    await this.updateHistory(sessionId, userResponse, followUpQuestion);

    return {
      followUpQuestion,
      realTimeAnalysis: analysis,
    };
  }

  async concludeInterview(sessionId: string): Promise<InterviewFeedback> {
    // Generate structured feedback with scoring
    const history = await this.loadFullHistory(sessionId);

    const feedback = await this.generateFeedback(history);

    return feedback;
  }
}
```

### 3. Agent Tools

#### 3.1 Resume Parser Tool

```typescript
export class ResumeParserTool extends Tool {
  name = 'resume_parser';
  description = 'Parses resume content and extracts structured information';

  constructor(private aiEngine: AIEngine) {
    super();
  }

  async _call(resumeContent: string): Promise<string> {
    const parsed = await this.aiEngine.parseResumeContent(resumeContent);
    return JSON.stringify(parsed);
  }
}
```

#### 3.2 RAG Retrieval Tool

```typescript
export class RAGRetrievalTool extends Tool {
  name = 'knowledge_retrieval';
  description = 'Retrieves relevant information from knowledge base';

  constructor(private ragService: RAGService) {
    super();
  }

  async _call(query: string): Promise<string> {
    const results = await this.ragService.retrieve(query, 5);
    return JSON.stringify(results);
  }
}
```

#### 3.3 Context Compressor Tool

```typescript
export class ContextCompressorTool {
  constructor(private aiEngineService: AIEngineService) {}

  async compress(
    conversationHistory: Message[],
    maxTokens: number = 500
  ): Promise<string> {
    // Use cost-optimized model for compression
    const fullHistory = conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const compressed = await this.aiEngineService.call(
      {
        model: '',
        prompt: `Summarize the following conversation in ${maxTokens} tokens or less, preserving key information:\n\n${fullHistory}`,
        maxTokens,
      },
      'system',
      'context-compression'
    );

    return compressed.content;
  }
}
```

### 4. Workflow Orchestrator

```typescript
export class WorkflowOrchestrator {
  constructor(
    private aiEngineService: AIEngineService,
    private usageTracker: UsageTrackerService,
    private performanceMonitor: PerformanceMonitorService
  ) {}

  async executeSequential(
    steps: WorkflowStep[],
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const results: any[] = [];

    for (const step of steps) {
      try {
        const result = await this.executeStep(step, context, results);
        results.push(result);

        // Cache intermediate results
        await this.cacheIntermediateResult(step.id, result);
      } catch (error) {
        // Handle error with fallback
        const fallbackResult = await this.handleStepError(step, error);
        results.push(fallbackResult);
      }
    }

    return {
      success: true,
      results,
      tokenUsage: this.calculateTokenUsage(results),
    };
  }

  async executeParallel(
    steps: WorkflowStep[],
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const promises = steps.map((step) => this.executeStep(step, context, []));

    const results = await Promise.allSettled(promises);

    return {
      success: results.every((r) => r.status === 'fulfilled'),
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
      tokenUsage: this.calculateTokenUsage(results),
    };
  }

  async executeConditional(
    condition: (context: WorkflowContext) => boolean,
    trueBranch: WorkflowStep[],
    falseBranch: WorkflowStep[],
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const steps = condition(context) ? trueBranch : falseBranch;
    return this.executeSequential(steps, context);
  }
}
```

### 5. Vector Database Service

```typescript
export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export class VectorDbService {
  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService
  ) {}

  async addDocuments(
    documents: { content: string; metadata: any }[]
  ): Promise<void> {
    for (const doc of documents) {
      const embedding = await this.embeddingService.generateEmbedding(
        doc.content
      );

      await this.prisma.vectorDocument.create({
        data: {
          content: doc.content,
          embedding,
          metadata: doc.metadata,
        },
      });
    }
  }

  async similaritySearch(
    query: string,
    k: number = 5
  ): Promise<VectorDocument[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Use pgvector for similarity search
    const results = await this.prisma.$queryRaw`
      SELECT id, content, embedding, metadata,
             1 - (embedding <=> ${queryEmbedding}::vector) as similarity
      FROM vector_documents
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${k}
    `;

    return results as VectorDocument[];
  }
}
```

### 6. RAG Service

```typescript
export class RAGService {
  constructor(
    private vectorDbService: VectorDbService,
    private aiEngineService: AIEngineService
  ) {}

  async retrieve(query: string, k: number = 5): Promise<string[]> {
    const documents = await this.vectorDbService.similaritySearch(query, k);
    return documents.map((doc) => doc.content);
  }

  async retrieveAndGenerate(query: string, userId: string): Promise<string> {
    // Step 1: Retrieve relevant documents
    const documents = await this.retrieve(query);

    // Step 2: Construct context
    const context = documents.join('\n\n');

    // Step 3: Generate response with context
    const response = await this.aiEngineService.call(
      {
        model: '',
        prompt: `Based on the following context, answer the question.\n\nContext:\n${context}\n\nQuestion: ${query}`,
      },
      userId,
      'rag-generation'
    );

    return response.content;
  }

  async retrieveQuestions(
    keywords: string[],
    experienceLevel: string
  ): Promise<InterviewQuestion[]> {
    const query = `Interview questions for ${keywords.join(', ')} at ${experienceLevel} level`;
    const documents = await this.vectorDbService.similaritySearch(query, 10);

    return documents.map((doc) => JSON.parse(doc.content));
  }
}
```

## Data Models

### Agent Session

```typescript
export interface AgentSession {
  id: string;
  userId: string;
  agentType: 'pitch-perfect' | 'strategist' | 'role-play';
  status: 'active' | 'completed' | 'failed';
  input: Record<string, any>;
  output: Record<string, any>;
  tokenUsage: {
    total: number;
    byStep: Record<string, number>;
  };
  cost: number;
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}
```

### Workflow Step

```typescript
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'llm-call' | 'tool-use' | 'rag-retrieval' | 'compression';
  modelTier: 'cost-optimized' | 'balanced' | 'quality-optimized';
  input: Record<string, any>;
  output?: Record<string, any>;
  tokenUsage?: number;
  latency?: number;
  error?: string;
}
```

### Vector Document Schema (Prisma)

```prisma
model VectorDocument {
  id        String   @id @default(cuid())
  content   String
  embedding Unsupported("vector(1536)")
  metadata  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([embedding], type: Ivfflat)
}
```

### Agent Session Schema (Prisma)

```prisma
model AgentSession {
  id          String   @id @default(cuid())
  userId      String
  agentType   String
  status      String
  input       Json
  output      Json?
  tokenUsage  Json
  cost        Float
  startedAt   DateTime @default(now())
  completedAt DateTime?
  metadata    Json?

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([agentType])
  @@index([status])
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: LangChain Adapter Routing

_For any_ LangChain LLM call, the request should be routed through the existing AIEngineService interface, ensuring all existing monitoring, tracking, and optimization features are applied.

**Validates: Requirements 1.3**

### Property 2: Backward Compatibility Preservation

_For any_ existing service that calls AIEngine or AIEngineService, the behavior and response format should remain unchanged after Agent integration.

**Validates: Requirements 1.6**

### Property 3: Chain Composition Support

_For any_ valid LangChain chain composition (sequential, parallel, or conditional), the system should successfully execute the chain and return results.

**Validates: Requirements 1.2**

### Property 4: STAR Achievement Extraction

_For any_ resume containing work experience, the Pitch Perfect Agent should extract achievements following the STAR principle (Situation, Task, Action, Result).

**Validates: Requirements 2.1**

### Property 5: Lightweight Model Usage for Parsing

_For any_ information extraction task (resume parsing, JD analysis), the Agent should use cost-optimized models or RAG instead of premium LLMs.

**Validates: Requirements 2.2, 5.2**

### Property 6: Highlight Count Constraint

_For any_ resume and JD pair, the Pitch Perfect Agent should identify between 3 and 5 highly relevant highlights.

**Validates: Requirements 2.3**

### Property 7: Multi-Duration Introduction Generation

_For any_ introduction generation request, the Agent should produce both 30-second and 60-second versions.

**Validates: Requirements 2.4**

### Property 8: Style Adaptation

_For any_ selected style (technical, managerial, sales), the generated introduction should reflect the characteristics of that style.

**Validates: Requirements 2.5**

### Property 9: Keyword Overlap Calculation

_For any_ generated introduction and JD, the system should calculate and return keyword overlap data including matched keywords, missing keywords, and overlap percentage.

**Validates: Requirements 2.6**

### Property 10: Iterative Refinement

_For any_ user feedback on an introduction, the Agent should generate a refined version that addresses the feedback.

**Validates: Requirements 2.7**

### Property 11: Question Categorization Completeness

_For any_ set of interview questions generated by the Strategist Agent, all questions should be categorized into technical, behavioral, or scenario-based types.

**Validates: Requirements 3.1, 3.2**

### Property 12: Difficulty Adaptation

_For any_ two users with different experience levels (junior vs senior), the questions generated for the senior user should have higher average difficulty.

**Validates: Requirements 3.3**

### Property 13: RAG Usage for Common Questions

_For any_ common question retrieval request, the Strategist Agent should use RAG to fetch from the knowledge base instead of calling the LLM.

**Validates: Requirements 3.5, 5.2**

### Property 14: Question Prioritization

_For any_ question bank, questions with high relevance to the user's resume and JD should be marked as "must-prepare".

**Validates: Requirements 3.6**

### Property 15: Performance-Based Adaptation

_For any_ completed mock interview with identified weak areas, the updated question bank should include more questions targeting those weak areas.

**Validates: Requirements 3.7**

### Property 16: Dialogue History Compression

_For any_ multi-turn conversation exceeding a token threshold, the system should compress the dialogue history before sending to the LLM.

**Validates: Requirements 4.3, 6.1**

### Property 17: Contextual Follow-Up Generation

_For any_ user response in a mock interview, the follow-up question should reference or build upon the content of that response.

**Validates: Requirements 4.4**

### Property 18: Multi-Aspect Response Analysis

_For any_ user response, the Role-Play Agent should evaluate all three aspects: keywords, logic, and speech patterns.

**Validates: Requirements 4.5**

### Property 19: Structured Feedback Generation

_For any_ completed mock interview, the feedback should include numerical scores for defined criteria (clarity, relevance, depth, etc.).

**Validates: Requirements 4.6**

### Property 20: Feedback Visualization Completeness

_For any_ interview feedback, the system should provide both radar chart data and a list of key improvement areas.

**Validates: Requirements 4.7**

### Property 21: Model Tier Routing Correctness

_For any_ Agent task, the system should route to the appropriate model tier: cost-optimized for parsing/retrieval, balanced for general tasks, quality-optimized for creative generation.

**Validates: Requirements 5.1, 5.3, 5.4, 5.5**

### Property 22: Model Selection Logging

_For any_ Agent workflow execution, every step should have a logged model selection decision including the model chosen and the reason.

**Validates: Requirements 5.6**

### Property 23: Context Compression Preservation

_For any_ compressed conversation history, the key information (main topics, decisions, user preferences) should be preserved in the summary.

**Validates: Requirements 6.2**

### Property 24: JSON Output Constraint

_For any_ LLM call requesting structured data, the output should be valid JSON conforming to the specified schema.

**Validates: Requirements 6.3**

### Property 25: Threshold-Triggered Compression

_For any_ context that exceeds the defined token threshold, the system should apply compression (sliding window or summarization) before the LLM call.

**Validates: Requirements 6.5**

### Property 26: Cache-First Behavior

_For any_ Agent query, the system should check the Redis cache before making an LLM call through AIEngineService.

**Validates: Requirements 7.1**

### Property 27: Cache Hit Efficiency

_For any_ cache hit, the system should return the cached result without invoking the LLM, resulting in zero additional token usage.

**Validates: Requirements 7.2**

### Property 28: Cache Expiration Handling

_For any_ expired cache entry that is accessed, the system should invalidate the entry and generate fresh content.

**Validates: Requirements 7.5**

### Property 29: Intermediate Result Caching

_For any_ completed workflow step, the system should cache the result with an appropriate TTL based on the step type.

**Validates: Requirements 7.6**

### Property 30: Workflow Error Resilience

_For any_ workflow step that fails, the system should handle the error gracefully without crashing the entire workflow, and should attempt fallback options if available.

**Validates: Requirements 8.3**

### Property 31: Workflow Step Logging

_For any_ workflow execution, every step should be logged with its input, output, duration, and status.

**Validates: Requirements 8.4**

### Property 32: Structured Workflow Results

_For any_ completed workflow, the system should return results in a structured format including success status, step results, and token usage.

**Validates: Requirements 8.5**

### Property 33: Embedding Storage Completeness

_For any_ document added to the vector database, the system should generate an embedding and store both the document content and its vector representation.

**Validates: Requirements 9.2**

### Property 34: Top-K Retrieval Accuracy

_For any_ semantic search query with parameter k, the system should return exactly k documents (or fewer if the database contains fewer than k documents).

**Validates: Requirements 9.3**

### Property 35: Similarity Score Inclusion

_For any_ vector search result, each returned document should include its similarity score to the query.

**Validates: Requirements 9.5**

### Property 36: Token Usage Tracking Completeness

_For any_ Agent LLM call, the system should record both input and output token counts through the existing UsageTrackerService.

**Validates: Requirements 10.1**

### Property 37: Multi-Dimensional Usage Aggregation

_For any_ usage report request, the system should support aggregation by Agent type, workflow step, and user.

**Validates: Requirements 10.2**

### Property 38: Token Savings Calculation

_For any_ usage report, the system should calculate and display token savings achieved through caching, compression, and model routing optimizations.

**Validates: Requirements 10.3**

### Property 39: Threshold Alert Triggering

_For any_ token usage that exceeds the configured threshold, the system should trigger an alert through the existing PerformanceMonitorService.

**Validates: Requirements 10.4**

### Property 40: Step-Level Token Breakdown

_For any_ completed Agent workflow, the system should generate a detailed token usage breakdown showing the token count for each step.

**Validates: Requirements 10.6**

### Property 41: Service Dependency Injection

_For any_ Agent implementation, it should inject and use existing services (AIEngineService, AIEngine, PromptTemplateManager, PerformanceMonitorService, UsageTrackerService, AILogger) rather than creating new instances.

**Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**

## Error Handling

### Error Categories

1. **LangChain Integration Errors**
   - Adapter initialization failures
   - Chain composition errors
   - Tool execution failures

2. **Agent Execution Errors**
   - Invalid input data
   - Workflow step failures
   - Timeout errors

3. **Resource Errors**
   - Vector database connection failures
   - Redis cache unavailability
   - LLM provider errors (handled by existing AIEngineService)

### Error Handling Strategy

```typescript
export class AgentErrorHandler {
  async handleError(
    error: Error,
    context: AgentExecutionContext
  ): Promise<AgentErrorResponse> {
    // Log error
    await this.aiLogger.logError(
      context.model,
      context.provider,
      this.categorizeError(error),
      error.message,
      error.stack,
      context.scenario,
      context.userId
    );

    // Determine if retryable
    if (this.isRetryable(error)) {
      return {
        shouldRetry: true,
        fallbackStrategy: 'retry-with-backoff',
      };
    }

    // Provide fallback
    if (this.hasFallback(context)) {
      return {
        shouldRetry: false,
        fallbackStrategy: 'use-cached-result',
        fallbackData: await this.getFallbackData(context),
      };
    }

    // Graceful degradation
    return {
      shouldRetry: false,
      fallbackStrategy: 'graceful-degradation',
      message: 'Agent temporarily unavailable. Please try again later.',
    };
  }
}
```

### Fallback Strategies

1. **Retry with Exponential Backoff**: For transient errors (network issues, rate limits)
2. **Use Cached Result**: Return last successful result if available
3. **Simplified Response**: Use lightweight model or template-based response
4. **Graceful Degradation**: Return partial results or error message

## Testing Strategy

### Unit Testing

Unit tests will verify individual components and functions:

- LangChain adapter initialization and configuration
- Individual Agent methods (extraction, matching, generation)
- Tool implementations (resume parser, RAG retrieval, context compressor)
- Workflow orchestrator logic (sequential, parallel, conditional)
- Error handling and fallback mechanisms

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** (JavaScript/TypeScript property testing library):

- Each property test will run a minimum of 100 iterations
- Tests will use smart generators that constrain to valid input spaces
- Each test will be tagged with the property number and requirement reference

Example property test structure:

```typescript
import * as fc from 'fast-check';

describe('PitchPerfectAgent Properties', () => {
  /**
   * Feature: langchain-agent-integration, Property 6: Highlight Count Constraint
   * Validates: Requirements 2.3
   */
  it('should generate 3-5 highlights for any resume/JD pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resume: resumeArbitrary(),
          jd: jobDescriptionArbitrary(),
        }),
        async ({ resume, jd }) => {
          const agent = new PitchPerfectAgent(
            aiEngineService,
            promptTemplateManager
          );
          const result = await agent.generate({
            resumeData: resume,
            jobDescription: jd,
            style: 'technical',
            duration: 60,
          });

          expect(result.highlights.length).toBeGreaterThanOrEqual(3);
          expect(result.highlights.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests will verify interactions between components:

- Agent workflows end-to-end
- LangChain adapter with AIEngineService
- Vector database operations
- Cache behavior with Redis
- Token tracking and cost calculation

### Performance Testing

Performance tests will verify optimization goals:

- Token usage reduction compared to baseline
- Response time for Agent workflows
- Cache hit rates
- Model routing effectiveness

## Token Optimization Strategies

### 1. Smart Model Routing

```typescript
export const MODEL_ROUTING_RULES = {
  // Cost-optimized for high-volume, low-complexity tasks
  'resume-parsing': 'cost-optimized',
  'jd-parsing': 'cost-optimized',
  'keyword-extraction': 'cost-optimized',
  'context-compression': 'cost-optimized',

  // Balanced for moderate complexity
  'question-categorization': 'balanced',
  'difficulty-assessment': 'balanced',

  // Quality-optimized for user-facing, creative tasks
  'introduction-generation': 'quality-optimized',
  'custom-question-generation': 'quality-optimized',
  'feedback-generation': 'quality-optimized',

  // RAG for knowledge retrieval (no LLM tokens)
  'common-questions': 'rag-only',
  'knowledge-lookup': 'rag-only',
};
```

### 2. Context Compression Techniques

```typescript
export class ContextCompressor {
  async compress(messages: Message[], maxTokens: number): Promise<string> {
    // Strategy 1: Sliding window (keep recent messages)
    if (messages.length <= 10) {
      return this.slidingWindow(messages, maxTokens);
    }

    // Strategy 2: Summarization (compress old messages)
    const recentMessages = messages.slice(-5);
    const oldMessages = messages.slice(0, -5);

    const summary = await this.summarize(oldMessages, maxTokens * 0.3);
    const recent = this.format(recentMessages);

    return `${summary}\n\nRecent conversation:\n${recent}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
```

### 3. Caching Strategy

```typescript
export class AgentCacheManager {
  // Cache TTLs by content type
  private readonly CACHE_TTLS = {
    'resume-parsing': 3600, // 1 hour
    'jd-parsing': 3600, // 1 hour
    'common-questions': 86400, // 24 hours
    introduction: 1800, // 30 minutes
    feedback: 3600, // 1 hour
  };

  async getCacheKey(
    agentType: string,
    input: Record<string, any>
  ): Promise<string> {
    // Create deterministic cache key from input
    const inputHash = this.hashObject(input);
    return `agent:${agentType}:${inputHash}`;
  }

  async getOrCompute<T>(
    cacheKey: string,
    ttl: number,
    computeFn: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Compute and cache
    const result = await computeFn();
    await this.redisService.set(cacheKey, JSON.stringify(result), ttl);

    return result;
  }
}
```

### 4. Batch Processing

```typescript
export class BatchProcessor {
  async batchGenerateCommonQuestions(): Promise<void> {
    // Pre-generate common questions for popular job roles
    const popularRoles = await this.getPopularJobRoles();

    for (const role of popularRoles) {
      const questions =
        await this.strategistAgent.generateCommonQuestions(role);

      // Store in vector database for RAG retrieval
      await this.vectorDbService.addDocuments(
        questions.map((q) => ({
          content: JSON.stringify(q),
          metadata: { role, type: 'common-question' },
        }))
      );
    }
  }
}
```

## Performance Monitoring

### Metrics to Track

1. **Token Usage Metrics**
   - Total tokens per Agent type
   - Token savings from caching
   - Token savings from compression
   - Token savings from model routing

2. **Performance Metrics**
   - Average response time per Agent
   - Cache hit rate
   - Model selection distribution
   - Error rate by Agent type

3. **Cost Metrics**
   - Cost per Agent execution
   - Cost savings from optimizations
   - Cost by user/scenario

### Monitoring Dashboard

```typescript
export interface AgentMetrics {
  period: { start: Date; end: Date };

  tokenUsage: {
    total: number;
    byAgent: Record<string, number>;
    byStep: Record<string, number>;
    savings: {
      fromCaching: number;
      fromCompression: number;
      fromRouting: number;
    };
  };

  performance: {
    averageLatency: Record<string, number>;
    cacheHitRate: number;
    errorRate: Record<string, number>;
  };

  cost: {
    total: number;
    byAgent: Record<string, number>;
    savings: number;
  };
}
```

## Security Considerations

1. **Input Validation**: All Agent inputs must be validated and sanitized
2. **Rate Limiting**: Implement per-user rate limits for Agent executions
3. **Data Privacy**: Ensure resume and JD data are properly encrypted at rest
4. **Access Control**: Verify user permissions before executing Agents
5. **Audit Logging**: Log all Agent executions for security auditing

## Deployment Strategy

### Phase 1: Infrastructure Setup (Week 1-2)

- Install LangChain dependencies
- Set up vector database (pgvector extension)
- Create AgentModule structure
- Implement LangChain adapters

### Phase 2: Core Agent Implementation (Week 3-5)

- Implement Pitch Perfect Agent
- Implement Strategist Agent
- Implement Role-Play Agent
- Add comprehensive tests

### Phase 3: Optimization Features (Week 6-7)

- Implement context compression
- Add intelligent caching
- Optimize model routing
- Add batch processing

### Phase 4: Monitoring & Refinement (Week 8)

- Set up monitoring dashboards
- Performance tuning
- Documentation
- User acceptance testing

## Migration Path

1. **Backward Compatibility**: Existing services continue to work unchanged
2. **Gradual Rollout**: Enable Agent features for beta users first
3. **Feature Flags**: Use feature flags to control Agent availability
4. **Monitoring**: Closely monitor token usage and costs during rollout
5. **Rollback Plan**: Ability to disable Agent features if issues arise

## Success Criteria

1. **Token Reduction**: Achieve 30-50% reduction in token usage for equivalent functionality
2. **Performance**: Agent workflows complete within 5 seconds for 90% of requests
3. **Accuracy**: Agent outputs meet quality standards (measured by user feedback)
4. **Reliability**: 99% success rate for Agent executions
5. **Cost Efficiency**: Reduce AI costs by 40% through optimizations
