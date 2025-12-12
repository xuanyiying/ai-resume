# Implementation Plan: LangChain Agent Integration

## Task List

- [x] 1. Setup LangChain Infrastructure
  - Install LangChain dependencies and configure vector database
  - Create AgentModule structure
  - Set up development environment
  - _Requirements: 1.1, 1.5, 9.1_

- [x] 1.1 Install LangChain and dependencies
  - Add langchain, @langchain/core, @langchain/community to package.json
  - Install pgvector extension for PostgreSQL
  - Add fast-check for property-based testing
  - _Requirements: 1.1, 9.1_

- [x] 1.2 Create AgentModule structure
  - Create packages/backend/src/agent directory
  - Set up agent.module.ts with proper imports (AIProvidersModule, PrismaModule, RedisModule)
  - Create subdirectories: adapters/, agents/, tools/, workflows/
  - _Requirements: 11.1_

- [x] 1.3 Add vector database schema to Prisma
  - Add VectorDocument model with pgvector support
  - Add AgentSession model for tracking executions
  - Run migration to create tables
  - _Requirements: 9.1, 9.2_

- [ ]\* 1.4 Write property test for vector database
  - **Property 33: Embedding Storage Completeness**
  - **Validates: Requirements 9.2**

- [x] 2. Implement LangChain Adapter Layer
  - Create adapters to integrate existing services with LangChain
  - Ensure backward compatibility
  - _Requirements: 1.2, 1.3, 1.6_

- [x] 2.1 Implement CustomLLM adapter
  - Create CustomLLM class extending LangChain's LLM base
  - Wrap AIEngineService.call() method
  - Handle streaming responses
  - _Requirements: 1.3_

- [ ]\* 2.2 Write property test for CustomLLM adapter
  - **Property 1: LangChain Adapter Routing**
  - **Validates: Requirements 1.3**

- [ ]\* 2.3 Write property test for backward compatibility
  - **Property 2: Backward Compatibility Preservation**
  - **Validates: Requirements 1.6**

- [x] 2.4 Implement CustomVectorStore adapter
  - Create CustomVectorStore extending VectorStore base
  - Integrate with VectorDbService
  - Implement similarity search
  - _Requirements: 1.5, 9.3_

- [ ]\* 2.5 Write property test for vector store
  - **Property 34: Top-K Retrieval Accuracy**
  - **Validates: Requirements 9.3**

- [ ]\* 2.6 Write property test for similarity scores
  - **Property 35: Similarity Score Inclusion**
  - **Validates: Requirements 9.5**

- [x] 2.7 Implement CustomMemory adapter
  - Create CustomMemory extending BaseChatMemory
  - Integrate with RedisService for conversation history
  - Implement TTL-based expiration
  - _Requirements: 4.3, 7.1_

- [ ]\* 2.8 Write property test for chain composition
  - **Property 3: Chain Composition Support**
  - **Validates: Requirements 1.2**

- [x] 3. Implement Core Services
  - Build supporting services for Agent functionality
  - _Requirements: 6.1, 6.2, 9.2, 9.3_

- [x] 3.1 Implement VectorDbService
  - Create service for vector database operations
  - Implement addDocuments() for storing embeddings
  - Implement similaritySearch() using pgvector
  - Inject PrismaService and EmbeddingService
  - _Requirements: 9.2, 9.3_

- [x] 3.2 Implement EmbeddingService
  - Create service to generate embeddings
  - Use OpenAI embeddings or local model
  - Cache embeddings for performance
  - _Requirements: 9.2_

- [x] 3.3 Implement RAGService
  - Create service for RAG operations
  - Implement retrieve() for document retrieval
  - Implement retrieveAndGenerate() for RAG generation
  - Implement retrieveQuestions() for question bank
  - Inject VectorDbService and AIEngineService
  - _Requirements: 3.5, 5.2_

- [ ]\* 3.4 Write property test for RAG retrieval
  - **Property 13: RAG Usage for Common Questions**
  - **Validates: Requirements 3.5, 5.2**

- [x] 3.5 Implement ContextCompressor
  - Create service for context compression
  - Implement compress() with sliding window strategy
  - Implement summarization for long conversations
  - Use cost-optimized models
  - _Requirements: 6.1, 6.2_

- [ ]\* 3.6 Write property test for context compression
  - **Property 16: Dialogue History Compression**
  - **Property 23: Context Compression Preservation**
  - **Validates: Requirements 4.3, 6.1, 6.2**

- [ ]\* 3.7 Write property test for threshold-triggered compression
  - **Property 25: Threshold-Triggered Compression**
  - **Validates: Requirements 6.5**

- [x] 3.8 Implement AgentCacheManager
  - Create service for Agent-specific caching
  - Implement getCacheKey() for deterministic keys
  - Implement getOrCompute() for cache-first pattern
  - Define TTLs by content type
  - Inject RedisService
  - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [ ]\* 3.9 Write property test for cache behavior
  - **Property 26: Cache-First Behavior**
  - **Property 27: Cache Hit Efficiency**
  - **Property 28: Cache Expiration Handling**
  - **Validates: Requirements 7.1, 7.2, 7.5**

- [x] 4. Implement Agent Tools
  - Create LangChain-compatible tools for Agents
  - _Requirements: 1.4, 2.2, 3.5_

- [x] 4.1 Implement ResumeParserTool
  - Create Tool extending LangChain's Tool base
  - Wrap AIEngine.parseResumeContent()
  - Return structured JSON
  - _Requirements: 1.4, 2.2_

- [x] 4.2 Implement JDAnalyzerTool
  - Create Tool for JD analysis
  - Wrap AIEngine.parseJobDescription()
  - Extract keywords and requirements
  - _Requirements: 1.4, 2.2_

- [x] 4.3 Implement KeywordMatcherTool
  - Create Tool for keyword matching
  - Compare resume highlights with JD keywords
  - Calculate overlap percentage
  - _Requirements: 2.3, 2.6_

- [x] 4.4 Implement RAGRetrievalTool
  - Create Tool for RAG retrieval
  - Wrap RAGService.retrieve()
  - Return relevant documents
  - _Requirements: 1.4, 3.5_

- [x] 4.5 Implement ContextCompressorTool
  - Create Tool for context compression
  - Wrap ContextCompressor.compress()
  - Handle different compression strategies
  - _Requirements: 1.4, 6.1_

- [x] 5. Implement Pitch Perfect Agent
  - Build Agent for personal introduction optimization
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5.1 Create PitchPerfectAgent class
  - Set up Agent structure with LangChain chains
  - Inject AIEngineService and PromptTemplateManager
  - Define input/output interfaces
  - _Requirements: 2.1, 11.2, 11.4_

- [x] 5.2 Implement STAR achievement extraction
  - Create method extractSTARachievements()
  - Use cost-optimized model for extraction
  - Parse resume data into STAR format
  - _Requirements: 2.1, 2.2_

- [ ]\* 5.3 Write property test for STAR extraction
  - **Property 4: STAR Achievement Extraction**
  - **Validates: Requirements 2.1**

- [ ]\* 5.4 Write property test for lightweight model usage
  - **Property 5: Lightweight Model Usage for Parsing**
  - **Validates: Requirements 2.2, 5.2**

- [x] 5.5 Implement keyword matching
  - Create method matchKeywords()
  - Match achievements with JD keywords
  - Select top 3-5 highlights
  - _Requirements: 2.3_

- [ ]\* 5.6 Write property test for highlight count
  - **Property 6: Highlight Count Constraint**
  - **Validates: Requirements 2.3**

- [x] 5.7 Implement introduction generation
  - Create method generateIntroduction()
  - Use quality-optimized model
  - Generate 30-second and 60-second versions
  - Support multiple styles (technical, managerial, sales)
  - _Requirements: 2.4, 2.5_

- [ ]\* 5.8 Write property test for multi-duration generation
  - **Property 7: Multi-Duration Introduction Generation**
  - **Validates: Requirements 2.4**

- [ ]\* 5.9 Write property test for style adaptation
  - **Property 8: Style Adaptation**
  - **Validates: Requirements 2.5**

- [x] 5.10 Implement keyword overlap calculation
  - Create method calculateKeywordOverlap()
  - Compare introduction with JD
  - Return matched, missing, and percentage
  - _Requirements: 2.6_

- [ ]\* 5.11 Write property test for keyword overlap
  - **Property 9: Keyword Overlap Calculation**
  - **Validates: Requirements 2.6**

- [x] 5.12 Implement iterative refinement
  - Create method refineIntroduction()
  - Accept user feedback
  - Generate improved version
  - _Requirements: 2.7_

- [ ]\* 5.13 Write property test for iterative refinement
  - **Property 10: Iterative Refinement**
  - **Validates: Requirements 2.7**

- [x] 5.14 Create PitchPerfectAgent controller
  - Create agent-pitch-perfect.controller.ts
  - Add endpoints for generation and refinement
  - Integrate with existing auth
  - _Requirements: 2.1-2.7_

- [x] 6. Implement Strategist Agent
  - Build Agent for interview question bank generation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6.1 Create StrategistAgent class
  - Set up Agent structure
  - Inject AIEngineService, RAGService, UsageTrackerService
  - Define input/output interfaces
  - _Requirements: 3.1, 11.2, 11.5_

- [x] 6.2 Implement context analysis
  - Create method analyzeContext()
  - Extract keywords from resume and JD
  - Determine focus areas
  - Use cost-optimized model
  - _Requirements: 3.1, 5.3_

- [x] 6.3 Implement common question retrieval
  - Create method retrieveCommonQuestions()
  - Use RAGService to fetch from knowledge base
  - Filter by experience level
  - _Requirements: 3.5_

- [x] 6.4 Implement custom question generation
  - Create method generateCustomQuestions()
  - Use quality-optimized model
  - Limit to 5 questions to save tokens
  - Personalize to user background
  - _Requirements: 3.4_

- [ ]\* 6.5 Write property test for custom question generation
  - **Property 14: Question Prioritization**
  - **Validates: Requirements 3.4, 3.6**

- [x] 6.6 Implement question prioritization
  - Create method prioritizeQuestions()
  - Mark high-relevance as "must-prepare"
  - Assign difficulty levels
  - Categorize by type
  - _Requirements: 3.2, 3.3, 3.6_

- [ ]\* 6.7 Write property test for question categorization
  - **Property 11: Question Categorization Completeness**
  - **Validates: Requirements 3.1, 3.2**

- [ ]\* 6.8 Write property test for difficulty adaptation
  - **Property 12: Difficulty Adaptation**
  - **Validates: Requirements 3.3**

- [x] 6.9 Implement performance-based updates
  - Create method updateBasedOnPerformance()
  - Analyze weak areas from interview
  - Add targeted questions
  - _Requirements: 3.7_

- [ ]\* 6.10 Write property test for performance-based adaptation
  - **Property 15: Performance-Based Adaptation**
  - **Validates: Requirements 3.7**

- [x] 6.11 Create StrategistAgent controller
  - Create agent-strategist.controller.ts
  - Add endpoints for question bank generation
  - Add endpoint for performance-based updates
  - _Requirements: 3.1-3.7_

- [x] 7. Implement Role-Play Agent] and
  - Build Agent for mock interview simulation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 7.1 Create RolePlayAgent class
  - Set up Agent structure
  - Inject AIEngineService, RedisService, PerformanceMonitorService
  - Define state management
  - _Requirements: 4.1, 11.2, 11.5_

- [x] 7.2 Implement interview initialization
  - Create method startInterview()
  - Initialize interviewer persona based on JD
  - Support different styles (strict, friendly, stress-test)
  - Generate opening question
  - _Requirements: 4.1, 4.2_

- [x] 7.3 Implement conversation history management
  - Create methods for loading/saving history
  - Integrate with CustomMemory
  - Apply compression for long conversations
  - _Requirements: 4.3_

- [x] 7.4 Implement response processing
  - Create method processUserResponse()
  - Analyze response in real-time
  - Generate contextual follow-up
  - Update conversation history
  - _Requirements: 4.4, 4.5_

- [ ]\* 7.5 Write property test for contextual follow-ups
  - **Property 17: Contextual Follow-Up Generation**
  - **Validates: Requirements 4.4**

- [ ]\* 7.6 Write property test for multi-aspect analysis
  - **Property 18: Multi-Aspect Response Analysis**
  - **Validates: Requirements 4.5**

- [x] 7.7 Implement response analysis
  - Create method analyzeResponse()
  - Evaluate keywords, logic, speech patterns
  - Provide real-time suggestions
  - _Requirements: 4.5_

- [x] 7.8 Implement interview conclusion
  - Create method concludeInterview()
  - Generate structured feedback
  - Calculate scores for criteria
  - Create radar chart data
  - Identify improvement areas
  - _Requirements: 4.6, 4.7_

- [ ]\* 7.9 Write property test for structured feedback
  - **Property 19: Structured Feedback Generation**
  - **Validates: Requirements 4.6**

- [ ]\* 7.10 Write property test for feedback visualization
  - **Property 20: Feedback Visualization Completeness**
  - **Validates: Requirements 4.7**

- [x] 7.11 Create RolePlayAgent controller
  - Create agent-role-play.controller.ts
  - Add endpoints for interview lifecycle
  - Add WebSocket support for real-time interaction
  - _Requirements: 4.1-4.7_

- [x] 8. Implement Workflow Orchestrator
  - Build orchestrator for complex Agent workflows
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8.1 Create WorkflowOrchestrator class
  - Set up orchestrator structure
  - Inject AIEngineService, UsageTrackerService, PerformanceMonitorService
  - Define workflow interfaces
  - _Requirements: 8.1, 11.2, 11.5_

- [x] 8.2 Implement sequential execution
  - Create method executeSequential()
  - Execute steps in order
  - Cache intermediate results
  - Handle step failures
  - _Requirements: 8.1, 8.3, 7.6_

- [ ]\* 8.3 Write property test for intermediate caching
  - **Property 29: Intermediate Result Caching**
  - **Validates: Requirements 7.6**

- [x] 8.4 Implement parallel execution
  - Create method executeParallel()
  - Execute steps concurrently
  - Aggregate results
  - _Requirements: 8.1_

- [x] 8.5 Implement conditional execution
  - Create method executeConditional()
  - Support decision nodes
  - Route based on conditions
  - _Requirements: 8.1, 8.2_

- [x] 8.6 Implement error handling
  - Create method handleStepError()
  - Provide fallback strategies
  - Ensure graceful degradation
  - _Requirements: 8.3_

- [ ]\* 8.7 Write property test for error resilience
  - **Property 30: Workflow Error Resilience**
  - **Validates: Requirements 8.3**

- [x] 8.8 Implement workflow logging
  - Log each step execution
  - Record input, output, duration, status
  - Track token usage per step
  - _Requirements: 8.4_

- [ ]\* 8.9 Write property test for workflow logging
  - **Property 31: Workflow Step Logging**
  - **Validates: Requirements 8.4**

- [ ]\* 8.10 Write property test for structured results
  - **Property 32: Structured Workflow Results**
  - **Validates: Requirements 8.5**

- [x] 9. Enhance Model Routing for Agents
  - Extend existing ModelSelector for Agent scenarios
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 9.1 Add Agent scenarios to ModelSelector
  - Add new scenario types for Agent tasks
  - Define routing rules for each Agent operation
  - Map to existing strategies (cost/quality/latency optimized)
  - _Requirements: 5.1_

- [ ]\* 9.2 Write property test for model tier routing
  - **Property 21: Model Tier Routing Correctness**
  - **Validates: Requirements 5.1, 5.3, 5.4, 5.5**

- [x] 9.3 Enhance selection logging for Agents
  - Extend ModelSelector to log Agent-specific decisions
  - Include workflow step context
  - Track optimization effectiveness
  - _Requirements: 5.6_

- [ ]\* 9.4 Write property test for selection logging
  - **Property 22: Model Selection Logging**
  - **Validates: Requirements 5.6**

- [x] 10. Implement Token Optimization Features
  - Add optimization strategies to reduce token usage
  - _Requirements: 6.3, 6.4_

- [x] 10.1 Implement JSON output constraints
  - Add JSON Schema validation to AIEngineService calls
  - Create helper for structured output requests
  - Minimize verbose explanations
  - _Requirements: 6.3, 6.4_

- [ ]\* 10.2 Write property test for JSON output
  - **Property 24: JSON Output Constraint**
  - **Validates: Requirements 6.3**

- [x] 10.3 Implement batch processing service
  - Create BatchProcessor class
  - Implement batchGenerateCommonQuestions()
  - Schedule during off-peak hours
  - Store results in vector database
  - _Requirements: 7.3, 7.4_

- [x] 10.4 Create optimization metrics calculator
  - Calculate token savings from caching
  - Calculate savings from compression
  - Calculate savings from model routing
  - _Requirements: 10.3_

- [ ]\* 10.5 Write property test for token savings calculation
  - **Property 38: Token Savings Calculation**
  - **Validates: Requirements 10.3**

- [-] 11. Enhance Usage Tracking for Agents
  - Extend existing UsageTrackerService for Agent metrics
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

- [x] 11.1 Add Agent-specific usage recording
  - Extend recordUsage() to include Agent type and workflow step
  - Track token usage by step
  - Calculate cost per Agent execution
  - _Requirements: 10.1, 10.2_

- [ ]\* 11.2 Write property test for token tracking
  - **Property 36: Token Usage Tracking Completeness**
  - **Validates: Requirements 10.1**

- [x] 11.2 Implement multi-dimensional aggregation
  - Add aggregation by Agent type
  - Add aggregation by workflow step
  - Extend existing user aggregation
  - _Requirements: 10.2_

- [ ]\* 11.3 Write property test for multi-dimensional aggregation
  - **Property 37: Multi-Dimensional Usage Aggregation**
  - **Validates: Requirements 10.2**

- [x] 11.4 Implement step-level token breakdown
  - Create method generateStepBreakdown()
  - Show token count for each workflow step
  - Include optimization savings
  - _Requirements: 10.6_

- [ ]\* 11.5 Write property test for step-level breakdown
  - **Property 40: Step-Level Token Breakdown**
  - **Validates: Requirements 10.6**

- [x] 11.6 Add threshold alerts for Agents
  - Extend PerformanceMonitorService for Agent thresholds
  - Trigger alerts on excessive token usage
  - _Requirements: 10.4_

- [ ]\* 11.7 Write property test for threshold alerts
  - **Property 39: Threshold Alert Triggering**
  - **Validates: Requirements 10.4**

- [x] 12. Create Agent Management API
  - Build API endpoints for Agent management and monitoring
  - _Requirements: 10.2, 10.3_

- [x] 12.1 Create AgentManagementController
  - Add endpoint to list available Agents
  - Add endpoint to get Agent status
  - Add endpoint to view Agent metrics
  - _Requirements: 10.2_

- [x] 12.2 Create AgentMetricsController
  - Add endpoint for token usage reports
  - Add endpoint for cost reports
  - Add endpoint for optimization savings
  - Support filtering by Agent type, user, date range
  - _Requirements: 10.2, 10.3_

- [x] 12.3 Add Agent session management endpoints
  - Add endpoint to list user's Agent sessions
  - Add endpoint to get session details
  - Add endpoint to cancel running session
  - _Requirements: 8.4_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Seed Knowledge Base
  - Populate vector database with initial data
  - _Requirements: 9.2, 9.4_

- [x] 14.1 Create knowledge base seeding script
  - Create script to load common interview questions
  - Generate embeddings for all documents
  - Store in vector database
  - _Requirements: 9.2_

- [x] 14.2 Seed common interview questions
  - Add questions for popular tech roles
  - Add questions by experience level
  - Add behavioral questions
  - _Requirements: 3.5_

- [x] 14.3 Seed STAR examples
  - Add example STAR-formatted achievements
  - Add templates for different industries
  - _Requirements: 2.1_

- [x] 15. Create Frontend Integration
  - Add UI components for Agent features
  - _Requirements: 2.6, 2.7, 3.6, 4.7_

- [x] 15.1 Create PitchPerfectAgent UI component
  - Add form for resume and JD input
  - Add style and duration selectors
  - Display generated introductions
  - Show keyword overlap visualization
  - Add feedback and refinement UI
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x] 15.2 Create StrategistAgent UI component
  - Display categorized question bank
  - Highlight "must-prepare" questions
  - Show difficulty levels
  - Add filtering and sorting
  - _Requirements: 3.2, 3.3, 3.6_

- [x] 15.3 Create RolePlayAgent UI component
  - Add interview configuration UI
  - Implement real-time chat interface
  - Display real-time analysis
  - Show feedback with radar chart
  - Highlight improvement areas
  - _Requirements: 4.2, 4.5, 4.7_

- [x] 15.4 Create Agent metrics dashboard
  - Display token usage by Agent
  - Show cost savings
  - Display performance metrics
  - Add date range filtering
  - _Requirements: 10.2, 10.3_

- [x] 16. Documentation and Deployment
  - Create documentation and prepare for deployment
  - _Requirements: All_

- [x] 16.1 Write API documentation
  - Document all Agent endpoints
  - Add request/response examples
  - Document error codes
  - _Requirements: All_

- [x] 16.2 Write user guide
  - Create guide for each Agent
  - Add best practices
  - Include examples
  - _Requirements: 2.1-4.7_

- [x] 16.3 Create deployment guide
  - Document infrastructure requirements
  - Add migration steps
  - Include rollback procedures
  - _Requirements: All_

- [x] 16.4 Set up monitoring dashboards
  - Create Grafana dashboards for Agent metrics
  - Add alerts for anomalies
  - Monitor token usage trends
  - _Requirements: 10.1-10.6_

- [ ] 17. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
