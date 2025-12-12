# Agent API Documentation

## Overview

This document provides comprehensive API documentation for the LangChain Agent Integration system. The system includes three core agents for interview preparation:

- **Pitch Perfect Agent**: Personal introduction optimization
- **Strategist Agent**: Interview question bank generation
- **Role-Play Agent**: Mock interview simulation

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Base URL

```
http://localhost:3000/api/agents
```

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Pitch Perfect Agent

### Generate Introduction

**Endpoint**: `POST /pitch-perfect/generate`

**Description**: Generate optimized personal introductions for a specific job position.

**Request Body**:

```json
{
  "resumeData": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "summary": "Senior Software Engineer with 5 years of experience",
    "experience": [
      {
        "company": "Tech Corp",
        "position": "Senior Engineer",
        "duration": "2020-2024",
        "description": "Led team of 5 engineers, improved system performance by 40%"
      }
    ],
    "skills": ["TypeScript", "React", "Node.js", "AWS"],
    "education": [
      {
        "school": "University",
        "degree": "BS Computer Science",
        "year": 2019
      }
    ]
  },
  "jobDescription": "We are looking for a Senior Full-Stack Engineer with 5+ years of experience in TypeScript and React. Must have AWS experience.",
  "style": "technical",
  "duration": 60
}
```

**Response** (200 OK):

```json
{
  "introduction": "Hi, I'm John Doe, a Senior Software Engineer with 5 years of experience building scalable web applications. I specialize in TypeScript and React, and have extensive AWS experience. At Tech Corp, I led a team of 5 engineers and improved system performance by 40%.",
  "highlights": [
    "5 years of software engineering experience",
    "Expert in TypeScript and React",
    "AWS infrastructure expertise",
    "Team leadership experience"
  ],
  "keywordOverlap": {
    "matched": ["Senior", "Full-Stack", "TypeScript", "React", "AWS"],
    "missing": ["5+ years"],
    "overlapPercentage": 83
  },
  "suggestions": [
    "Emphasize your team leadership experience more",
    "Highlight specific AWS services you've used"
  ]
}
```

**Error Response** (500 Internal Server Error):

```json
{
  "statusCode": 500,
  "message": "Failed to generate pitch",
  "error": "LLM service unavailable"
}
```

### Refine Introduction

**Endpoint**: `POST /pitch-perfect/refine`

**Description**: Refine an introduction based on user feedback.

**Request Body**:

```json
{
  "currentIntroduction": "Hi, I'm John Doe, a Senior Software Engineer...",
  "feedback": "Make it more concise and focus on leadership experience"
}
```

**Response** (200 OK):

```json
{
  "refinedIntroduction": "I'm John Doe, a Senior Software Engineer with 5 years of experience leading high-performing teams. I specialize in TypeScript, React, and AWS, and have a proven track record of improving system performance and team productivity."
}
```

## Strategist Agent

### Generate Question Bank

**Endpoint**: `POST /strategist/generate`

**Description**: Generate a customized interview question bank based on resume and job description.

**Request Body**:

```json
{
  "resumeData": {
    "name": "John Doe",
    "experience": [
      {
        "company": "Tech Corp",
        "position": "Senior Engineer",
        "duration": "2020-2024",
        "description": "Led team of 5 engineers"
      }
    ],
    "skills": ["TypeScript", "React", "Node.js", "AWS"]
  },
  "jobDescription": "Senior Full-Stack Engineer position requiring TypeScript, React, and AWS experience",
  "experienceLevel": "senior"
}
```

**Response** (200 OK):

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "Tell me about a time you led a team through a challenging project",
      "category": "behavioral",
      "difficulty": "medium",
      "priority": "must-prepare",
      "source": "custom",
      "suggestedAnswerLength": "2-3 minutes"
    },
    {
      "id": "q2",
      "question": "How do you optimize React component performance?",
      "category": "technical",
      "difficulty": "hard",
      "priority": "must-prepare",
      "source": "knowledge-base",
      "suggestedAnswerLength": "3-5 minutes"
    }
  ],
  "categorization": {
    "technical": 8,
    "behavioral": 5,
    "scenario": 3
  },
  "totalQuestions": 16,
  "focusAreas": ["Leadership", "React Performance", "AWS Architecture"]
}
```

### Update Question Bank Based on Performance

**Endpoint**: `POST /strategist/update-performance`

**Description**: Update question bank based on mock interview performance.

**Request Body**:

```json
{
  "performance": {
    "weakAreas": ["AWS Architecture", "System Design"],
    "strongAreas": ["React", "Team Leadership"],
    "overallScore": 72,
    "sessionId": "session-123"
  }
}
```

**Response** (200 OK):

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "Design a scalable AWS architecture for a high-traffic e-commerce platform",
      "category": "scenario",
      "difficulty": "hard",
      "priority": "must-prepare",
      "source": "custom",
      "reason": "Based on weak performance in AWS Architecture"
    }
  ],
  "categorization": {
    "technical": 6,
    "behavioral": 4,
    "scenario": 6
  },
  "totalQuestions": 16,
  "focusAreas": ["AWS Architecture", "System Design"]
}
```

## Role-Play Agent

### Start Interview

**Endpoint**: `POST /role-play/start`

**Description**: Start a new mock interview session.

**Request Body**:

```json
{
  "jobDescription": "Senior Full-Stack Engineer at Tech Corp",
  "interviewerStyle": "strict",
  "focusAreas": ["Leadership", "Technical Skills"],
  "resumeData": {
    "name": "John Doe",
    "experience": [
      {
        "company": "Tech Corp",
        "position": "Senior Engineer",
        "duration": "2020-2024"
      }
    ]
  }
}
```

**Response** (200 OK):

```json
{
  "sessionId": "session-abc123",
  "conversationHistory": [],
  "currentQuestion": "Tell me about your most significant technical achievement in your current role.",
  "askedQuestions": [
    "Tell me about your most significant technical achievement in your current role."
  ],
  "userPerformance": {
    "clarity": 0,
    "relevance": 0,
    "depth": 0
  }
}
```

### Process User Response

**Endpoint**: `POST /role-play/respond`

**Description**: Process user response and generate follow-up question.

**Request Body**:

```json
{
  "sessionId": "session-abc123",
  "userResponse": "I led the migration of our monolithic application to microservices, which improved deployment time by 60% and reduced system downtime by 80%."
}
```

**Response** (200 OK):

```json
{
  "followUpQuestion": "That's impressive. Can you walk me through the technical challenges you faced during the migration and how you overcame them?",
  "realTimeAnalysis": {
    "keywords": ["migration", "microservices", "deployment", "performance"],
    "sentiment": "positive",
    "suggestions": [
      "Provide more specific technical details about the architecture",
      "Mention the team size and collaboration"
    ],
    "relevanceScore": 0.92
  }
}
```

### Conclude Interview

**Endpoint**: `POST /role-play/conclude`

**Description**: Conclude the interview and generate feedback.

**Request Body**:

```json
{
  "sessionId": "session-abc123"
}
```

**Response** (200 OK):

```json
{
  "sessionId": "session-abc123",
  "overallScore": 78,
  "feedback": {
    "strengths": [
      "Clear communication of technical concepts",
      "Strong examples with quantifiable results",
      "Good understanding of system design"
    ],
    "improvements": [
      "Provide more context about team dynamics",
      "Elaborate on decision-making process",
      "Discuss trade-offs more thoroughly"
    ]
  },
  "scoringCriteria": {
    "clarity": 8,
    "relevance": 8,
    "depth": 7,
    "communication": 8,
    "technicalKnowledge": 8
  },
  "radarChartData": {
    "categories": [
      "Clarity",
      "Relevance",
      "Depth",
      "Communication",
      "Technical"
    ],
    "scores": [8, 8, 7, 8, 8]
  },
  "improvementAreas": [
    "System Design (score: 6/10)",
    "Behavioral Questions (score: 7/10)"
  ],
  "nextSteps": [
    "Practice system design questions",
    "Work on storytelling for behavioral questions",
    "Review AWS architecture patterns"
  ]
}
```

### Get Interview Feedback

**Endpoint**: `GET /role-play/feedback/:sessionId`

**Description**: Retrieve feedback for a completed interview session.

**Response** (200 OK):

```json
{
  "sessionId": "session-abc123",
  "overallScore": 78,
  "feedback": {
    "strengths": ["Clear communication", "Strong examples"],
    "improvements": ["More context needed", "Elaborate on decisions"]
  },
  "scoringCriteria": {
    "clarity": 8,
    "relevance": 8,
    "depth": 7
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "statusCode": 404,
  "message": "Feedback not found"
}
```

## Agent Management

### List Available Agents

**Endpoint**: `GET /management/list`

**Description**: List all available agents.

**Response** (200 OK):

```json
[
  {
    "agentType": "pitch-perfect",
    "displayName": "Pitch Perfect",
    "description": "Personal introduction optimization for job interviews",
    "isAvailable": true,
    "totalSessions": 42
  },
  {
    "agentType": "strategist",
    "displayName": "Strategist",
    "description": "Interview question bank generation and customization",
    "isAvailable": true,
    "totalSessions": 28
  },
  {
    "agentType": "role-play",
    "displayName": "Role-Play",
    "description": "Mock interview simulation with real-time feedback",
    "isAvailable": true,
    "totalSessions": 15
  }
]
```

### Get Agent Status

**Endpoint**: `GET /management/status?agentType=pitch-perfect`

**Description**: Get status of a specific agent.

**Query Parameters**:

- `agentType` (required): Type of agent (pitch-perfect, strategist, role-play)

**Response** (200 OK):

```json
{
  "agentType": "pitch-perfect",
  "displayName": "Pitch Perfect",
  "description": "Personal introduction optimization for job interviews",
  "isAvailable": true,
  "lastUsed": "2024-12-12T10:30:00Z",
  "totalSessions": 42
}
```

### View Agent Metrics

**Endpoint**: `GET /management/metrics?agentType=pitch-perfect`

**Description**: View metrics for a specific agent.

**Query Parameters**:

- `agentType` (required): Type of agent

**Response** (200 OK):

```json
{
  "agentType": "pitch-perfect",
  "totalSessions": 42,
  "successfulSessions": 40,
  "failedSessions": 2,
  "averageTokensPerSession": 1250,
  "totalTokensUsed": 52500,
  "totalCost": 0.52,
  "successRate": 95
}
```

## Agent Metrics

### Get Token Usage Report

**Endpoint**: `GET /metrics/token-usage?startDate=2024-12-01&endDate=2024-12-31&groupBy=agent-type`

**Description**: Get token usage report with filtering and grouping options.

**Query Parameters**:

- `startDate` (required): Start date in ISO 8601 format (YYYY-MM-DD)
- `endDate` (required): End date in ISO 8601 format (YYYY-MM-DD)
- `groupBy` (optional): Group by 'agent-type', 'workflow-step', or 'model' (default: agent-type)
- `agentType` (optional): Filter by specific agent type

**Response** (200 OK):

```json
{
  "period": {
    "startDate": "2024-12-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  },
  "groupBy": "agent-type",
  "totalTokens": 125000,
  "items": [
    {
      "key": "pitch-perfect",
      "totalTokens": 52500,
      "inputTokens": 35000,
      "outputTokens": 17500,
      "callCount": 42,
      "averageTokensPerCall": 1250
    },
    {
      "key": "strategist",
      "totalTokens": 45000,
      "inputTokens": 30000,
      "outputTokens": 15000,
      "callCount": 28,
      "averageTokensPerCall": 1607
    }
  ]
}
```

### Get Cost Report

**Endpoint**: `GET /metrics/cost?startDate=2024-12-01&endDate=2024-12-31&groupBy=agent-type`

**Description**: Get cost report with filtering and grouping options.

**Query Parameters**:

- `startDate` (required): Start date in ISO 8601 format
- `endDate` (required): End date in ISO 8601 format
- `groupBy` (optional): Group by 'agent-type', 'workflow-step', or 'model'
- `agentType` (optional): Filter by specific agent type

**Response** (200 OK):

```json
{
  "period": {
    "startDate": "2024-12-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  },
  "groupBy": "agent-type",
  "totalCost": 1.25,
  "items": [
    {
      "key": "pitch-perfect",
      "cost": 0.52,
      "callCount": 42,
      "inputTokens": 35000,
      "outputTokens": 17500,
      "averageCostPerCall": 0.0124
    },
    {
      "key": "strategist",
      "cost": 0.45,
      "callCount": 28,
      "inputTokens": 30000,
      "outputTokens": 15000,
      "averageCostPerCall": 0.0161
    }
  ]
}
```

### Get Optimization Savings Report

**Endpoint**: `GET /metrics/optimization-savings?startDate=2024-12-01&endDate=2024-12-31`

**Description**: Get report on token savings from optimization strategies.

**Query Parameters**:

- `startDate` (required): Start date in ISO 8601 format
- `endDate` (required): End date in ISO 8601 format
- `agentType` (optional): Filter by specific agent type

**Response** (200 OK):

```json
{
  "period": {
    "startDate": "2024-12-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  },
  "totalSavingsFromCaching": 15000,
  "totalSavingsFromCompression": 8500,
  "totalSavingsFromModelRouting": 6200,
  "totalSavings": 29700,
  "savingsPercentage": 19.2
}
```

## Request/Response Examples

### Example 1: Complete Pitch Perfect Workflow

1. Generate pitch:

```bash
curl -X POST http://localhost:3000/api/agents/pitch-perfect/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": {...},
    "jobDescription": "...",
    "style": "technical",
    "duration": 60
  }'
```

2. Refine based on feedback:

```bash
curl -X POST http://localhost:3000/api/agents/pitch-perfect/refine \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentIntroduction": "...",
    "feedback": "Make it more concise"
  }'
```

### Example 2: Complete Role-Play Workflow

1. Start interview:

```bash
curl -X POST http://localhost:3000/api/agents/role-play/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobDescription": "...",
    "interviewerStyle": "strict",
    "focusAreas": [...]
  }'
```

2. Process responses (repeat as needed):

```bash
curl -X POST http://localhost:3000/api/agents/role-play/respond \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-abc123",
    "userResponse": "..."
  }'
```

3. Conclude interview:

```bash
curl -X POST http://localhost:3000/api/agents/role-play/conclude \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-abc123"
  }'
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- 100 requests per minute per user for standard endpoints
- 10 requests per minute per user for resource-intensive endpoints (generate, conclude)

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702400000
```

## Pagination

List endpoints support pagination:

**Query Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Versioning

The API uses URL versioning. Current version is v1:

```
/api/v1/agents/...
```

Future versions will be available at:

```
/api/v2/agents/...
```

## Support

For API support and issues, please contact:

- Email: support@example.com
- Documentation: https://docs.example.com/agents
- Issues: https://github.com/example/issues
