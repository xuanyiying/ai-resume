# Requirements Document

## Introduction

本文档定义了将 LangChain 框架和 Agent 功能整合到现有面试辅导系统的需求。系统将实现三个核心 Agent（个人介绍优化 Agent、题库构建 Agent、面试官模拟 Agent），并通过智能任务分级、上下文压缩和缓存机制显著降低大模型 Token 消耗，同时提升用户体验。

## Glossary

- **LangChain**: 用于构建基于大语言模型应用的开源框架
- **Agent**: 能够自主决策、使用工具并执行多步骤任务的智能代理
- **RAG (Retrieval-Augmented Generation)**: 检索增强生成，通过检索相关信息来增强模型输出
- **Token**: 大语言模型处理文本的基本单位
- **STAR 原则**: Situation（情境）、Task（任务）、Action（行动）、Result（结果）的面试回答框架
- **JD (Job Description)**: 职位描述
- **System Prompt**: 系统提示词，用于设定模型行为的初始指令
- **Vector Database**: 向量数据库，用于存储和检索文本嵌入向量
- **AIEngine**: 现有的 AI 引擎服务，提供文件解析和基础 AI 调用功能
- **AIEngineService**: 现有的多提供商 AI 引擎服务，支持模型选择、成本追踪和性能监控
- **AIProvidersModule**: 现有的 AI 提供商模块，管理多个 LLM 提供商（OpenAI、Qwen、DeepSeek 等）
- **LangChain Adapter**: 适配器层，将现有 AIEngineService 接口适配到 LangChain 框架

## Requirements

### Requirement 1: LangChain 框架集成与现有系统适配

**User Story:** 作为系统架构师，我希望将 LangChain 框架集成到现有的 AIEngine 和 AIProvidersModule 中，以便在保持现有功能的同时构建和管理复杂的 Agent 工作流。

#### Acceptance Criteria

1. WHEN the backend system initializes THEN the System SHALL load LangChain framework and create adapter for AIEngineService
2. WHEN an Agent workflow is defined THEN the System SHALL support chain composition using LangChain primitives
3. WHEN LangChain calls LLM THEN the System SHALL route requests through existing AIEngineService interface
4. WHEN an Agent requires tool usage THEN the System SHALL provide LangChain-compatible tool definitions
5. WHERE vector storage is needed THEN the System SHALL integrate a vector database compatible with LangChain
6. WHEN existing services call AI THEN the System SHALL maintain backward compatibility with current AIEngine interface

### Requirement 2: 个人介绍优化 Agent (Pitch Perfect Agent)

**User Story:** 作为求职者，我希望快速生成针对特定职位的优化自我介绍，以便在面试中更好地展示自己。

#### Acceptance Criteria

1. WHEN a user uploads resume and provides target JD THEN the Pitch Perfect Agent SHALL extract key achievements using STAR principle
2. WHEN resume data is parsed THEN the Agent SHALL use lightweight models or RAG for information extraction
3. WHEN matching resume to JD THEN the Agent SHALL identify 3-5 highly relevant highlights based on keyword alignment
4. WHEN generating introduction THEN the Agent SHALL produce versions for 30-second and 60-second durations
5. WHEN user selects a style THEN the Agent SHALL generate introductions in technical, managerial, or sales-oriented tones
6. WHEN introduction is generated THEN the System SHALL display keyword overlap visualization between introduction and JD
7. WHEN user provides feedback THEN the Agent SHALL iterate and refine the introduction based on user input

### Requirement 3: 题库构建 Agent (Strategist Agent)

**User Story:** 作为求职者，我希望获得根据我的背景和目标职位定制的面试题库，以便高效准备面试。

#### Acceptance Criteria

1. WHEN user provides resume and target JD THEN the Strategist Agent SHALL analyze and categorize potential interview questions
2. WHEN categorizing questions THEN the Agent SHALL classify questions into technical, behavioral, and scenario-based types
3. WHEN determining difficulty THEN the Agent SHALL adjust question complexity based on user experience level
4. WHEN generating custom questions THEN the Agent SHALL call LLM to create high-value personalized questions
5. WHEN retrieving common questions THEN the Agent SHALL use RAG to fetch answers from knowledge base
6. WHEN displaying questions THEN the System SHALL mark highly relevant questions as "must-prepare"
7. WHEN user completes mock interview THEN the Agent SHALL dynamically update question bank based on performance

### Requirement 4: 面试官模拟 Agent (Role-Play Agent)

**User Story:** 作为求职者，我希望进行高拟真度的模拟面试，以便在真实面试前充分练习。

#### Acceptance Criteria

1. WHEN mock interview starts THEN the Role-Play Agent SHALL initialize interviewer persona based on JD
2. WHEN setting interviewer style THEN the Agent SHALL support strict, friendly, and stress-test personalities
3. WHEN conversation progresses THEN the Agent SHALL maintain dialogue history using summarization
4. WHEN user answers a question THEN the Agent SHALL generate follow-up questions based on previous responses
5. WHEN analyzing user response THEN the Agent SHALL evaluate keywords, logic, and speech patterns in real-time
6. WHEN interview concludes THEN the Agent SHALL generate structured feedback with scoring
7. WHEN displaying feedback THEN the System SHALL present radar chart and highlight key improvement areas

### Requirement 5: 增强任务分级与模型路由

**User Story:** 作为系统管理员，我希望在现有 ModelSelector 基础上增强任务分级能力，以便更智能地将 Agent 任务分配给不同成本的模型。

#### Acceptance Criteria

1. WHEN an Agent task is received THEN the System SHALL extend ModelSelector to classify Agent task complexity
2. WHEN performing knowledge retrieval THEN the Agent SHALL use RAG or small local models instead of large LLMs
3. WHEN parsing structured data THEN the Agent SHALL leverage existing cost-optimized scenario routing
4. WHEN creative generation is required THEN the Agent SHALL use existing quality-optimized scenario routing
5. WHEN complex reasoning is needed THEN the Agent SHALL route to high-tier models through AIEngineService
6. WHEN Agent workflow executes THEN the System SHALL log model selection decisions for each step

### Requirement 6: 上下文压缩与优化

**User Story:** 作为系统开发者，我希望减少传递给大模型的上下文长度，以便降低 Token 消耗。

#### Acceptance Criteria

1. WHEN multi-turn conversation occurs THEN the System SHALL compress dialogue history before sending to LLM
2. WHEN compressing context THEN the System SHALL summarize conversation into key state information
3. WHEN generating LLM output THEN the System SHALL constrain output format using JSON Schema
4. WHEN structured data is needed THEN the System SHALL request JSON format to minimize verbose explanations
5. WHEN context exceeds threshold THEN the System SHALL apply sliding window or summarization strategy

### Requirement 7: 增强缓存与批量处理

**User Story:** 作为系统管理员，我希望在现有 Redis 缓存基础上为 Agent 工作流添加智能缓存和批量处理，以便优化系统性能和成本。

#### Acceptance Criteria

1. WHEN an Agent query is received THEN the System SHALL check Redis cache before calling LLM through AIEngineService
2. WHEN cache hit occurs THEN the System SHALL return cached result without LLM invocation
3. WHEN generating common content THEN the Agent SHALL batch process during off-peak hours
4. WHEN batch results are ready THEN the System SHALL store results in database for instant retrieval
5. WHEN cache entry expires THEN the System SHALL invalidate and refresh cached content
6. WHEN Agent workflow step completes THEN the System SHALL cache intermediate results with appropriate TTL

### Requirement 8: Agent 工作流编排

**User Story:** 作为系统开发者，我希望定义清晰的 Agent 工作流，以便实现复杂的多步骤任务。

#### Acceptance Criteria

1. WHEN defining Agent workflow THEN the System SHALL support sequential, parallel, and conditional execution patterns
2. WHEN Agent requires decision-making THEN the System SHALL provide decision nodes in workflow
3. WHEN workflow step fails THEN the System SHALL handle errors gracefully and provide fallback options
4. WHEN monitoring workflow THEN the System SHALL log each step execution for debugging
5. WHEN workflow completes THEN the System SHALL return structured results to calling service

### Requirement 9: 向量数据库集成

**User Story:** 作为系统开发者，我希望集成向量数据库来支持 RAG 功能，以便高效检索相关信息。

#### Acceptance Criteria

1. WHEN system initializes THEN the System SHALL connect to vector database with proper credentials
2. WHEN storing embeddings THEN the System SHALL generate and store vector representations of documents
3. WHEN performing semantic search THEN the System SHALL retrieve top-k most relevant documents
4. WHEN updating knowledge base THEN the System SHALL support incremental embedding updates
5. WHEN querying vectors THEN the System SHALL return results with similarity scores

### Requirement 10: 增强 Token 使用监控与报告

**User Story:** 作为系统管理员，我希望在现有 UsageTrackerService 基础上增加 Agent 级别的 Token 监控，以便优化成本和识别异常使用模式。

#### Acceptance Criteria

1. WHEN Agent calls LLM THEN the System SHALL record input and output token counts through existing UsageTrackerService
2. WHEN aggregating metrics THEN the System SHALL calculate token usage by Agent type, workflow step, and user
3. WHEN displaying reports THEN the System SHALL show token savings from Agent optimization strategies
4. WHEN usage exceeds threshold THEN the System SHALL trigger alerts through existing PerformanceMonitorService
5. WHEN analyzing patterns THEN the System SHALL identify opportunities for further Agent workflow optimization
6. WHEN Agent workflow completes THEN the System SHALL generate detailed token usage breakdown by step

### Requirement 11: 现有服务整合与模块化

**User Story:** 作为系统开发者，我希望 Agent 功能作为独立模块整合到现有架构中，以便保持代码组织清晰和可维护性。

#### Acceptance Criteria

1. WHEN creating Agent module THEN the System SHALL create separate AgentModule that imports AIProvidersModule
2. WHEN Agent needs AI capabilities THEN the Agent SHALL inject and use AIEngineService
3. WHEN Agent needs file parsing THEN the Agent SHALL inject and use existing AIEngine
4. WHEN Agent needs prompt templates THEN the Agent SHALL use existing PromptTemplateManager
5. WHEN Agent needs monitoring THEN the Agent SHALL use existing PerformanceMonitorService and UsageTrackerService
6. WHEN Agent needs logging THEN the Agent SHALL use existing AILogger
7. WHEN existing services need Agent capabilities THEN the System SHALL expose Agent services through clear interfaces
