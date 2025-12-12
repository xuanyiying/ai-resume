# Resume Optimizer Platform

AI-powered resume optimization SaaS platform that helps job seekers improve their resumes using advanced AI algorithms.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Detailed Architecture Diagram](#detailed-architecture-diagram)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [License](#license)

## Overview

Resume Optimizer is a comprehensive SaaS platform designed to help job seekers enhance their resumes using artificial intelligence. The platform analyzes resumes against job descriptions, provides targeted improvement suggestions, generates optimized content, and creates professional PDF documents. With support for multiple AI providers and a complete subscription system, it offers a scalable solution for career advancement.

## Key Features

### Full Interview Process Guidance

- Personalized interview preparation plan
- Interview skills training and advice
- Interview progress tracking and feedback
- Interview performance analysis and improvement suggestions

### Self-Introduction Optimization

- Customized self-introduction based on target position
- Personalized opening statement generation
- Language expression optimization and polishing
- Self-introduction templates for different scenarios

### AI-Powered Resume Analysis

- Intelligent parsing of resumes in various formats (PDF, DOCX, TXT)
- Detailed analysis of resume content against job descriptions
- Match scoring with breakdown by skills, experience, education, and keywords
- Actionable suggestions for improvement

### Multi-Provider AI Support

- Support for major AI providers: OpenAI, Qwen, DeepSeek, Gemini, and Ollama
- Automatic model selection based on performance and availability
- Built-in fallback mechanisms for high availability
- Usage tracking and cost monitoring

### Resume Optimization

- Content enhancement suggestions
- Keyword optimization for applicant tracking systems (ATS)
- Structure improvements for better readability
- Quantification of achievements

### Professional Document Generation

- Multiple premium templates for resume presentation
- Customizable PDF generation options
- Cover letter generation capabilities
- Professional formatting and design

### Interview Question Prediction and Answers

- AI-generated interview questions based on resume and job
- Behavioral, technical, and situational questions
- Suggested answers and tips for common questions
- Practice interview sessions

### One-on-One Mock Interviews

- Real-time video mock interviews
- AI interviewer functionality
- Interview session recording and playback
- Personalized feedback and scoring

### Subscription & Payment System

- Tiered subscription plans (Free, Pro, Enterprise)
- Integration with Stripe and Paddle payment processors
- Usage quotas based on subscription tier
- Flexible billing periods (monthly/yearly)

### Advanced Features

- Real-time chat interface for interactive assistance
- Resume versioning and history tracking
- Job tracking and application management
- Performance monitoring and analytics

## Technology Stack

### Backend

- **Framework**: [NestJS](https://nestjs.com/) - Progressive Node.js framework
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Caching**: [Redis](https://redis.io/) - In-memory data structure store
- **Authentication**: JWT with Passport.js
- **AI Providers**: OpenAI, Qwen, DeepSeek, Gemini, Ollama
- **File Storage**: AWS S3, Aliyun OSS, Tencent COS, MinIO
- **Logging**: Winston with structured JSON logging
- **API Documentation**: Swagger/OpenAPI with NestJS Swagger
- **Validation**: class-validator and class-transformer
- **Testing**: Jest for unit and integration tests
- **Containerization**: Docker and Docker Compose
- **Monitoring**: Prometheus, Grafana, Loki for metrics and logs

### Frontend

- **Framework**: [React 18](https://reactjs.org/) with [Vite](https://vitejs.dev/)
- **Language**: TypeScript
- **UI Library**: [Ant Design 5](https://ant.design/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Testing**: Vitest with React Testing Library
- **Build Tool**: Vite with Rollup
- **Progressive Web App**: Workbox for offline support

## Architecture

The platform follows a modern microservices-inspired architecture within a monorepo:

```
┌─────────────────┐    ┌──────────────────┐
│   Frontend      │    │   Load Balancer  │
│   (React/Vite)  │◄──►│   (Nginx)        │
└─────────────────┘    └─────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │   Backend  │            │
                    │  (NestJS)  │            │
                    └─────┬──────┘            │
                          │                   │
             ┌────────────┼────────────┐      │
             │ PostgreSQL │   Redis    │      │
             │ (Primary   │ (Caching/  │◄─────┘
             │  Storage)  │  Sessions) │
             └────────────┴────────────┘
```

### Backend Architecture

- Modular design with feature-based modules
- Clean separation of concerns with services, controllers, and DTOs
- Event-driven processing with Bull queues
- Comprehensive error handling and logging
- Security best practices (helmet, CORS, rate limiting)

### Data Flow

1. User uploads resume and enters job description
2. System parses documents using AI
3. AI engine compares resume with job requirements
4. Detailed analysis and suggestions are generated
5. User can accept/reject suggestions
6. Optimized resume is generated in PDF format
7. Interview questions are prepared based on content

## Detailed Architecture Diagram

```mermaid
flowchart TD
    A[User Interface] --> B[Load Balancer/Nginx]
    B --> C[Frontend App React/Vite]
    B --> D[Backend Service NestJS]
    
    C <--> D
    
    D --> E[PostgreSQL Database]
    D --> F[Redis Cache]
    
    D --> G[AI Providers]
    G --> G1[OpenAI]
    G --> G2[Qwen]
    G --> G3[DeepSeek]
    G --> G4[Gemini]
    G --> G5[Ollama]
    
    D --> H[Object Storage]
    H --> H1[AWS S3]
    H --> H2[Aliyun OSS]
    H --> H3[Tencent COS]
    H --> H4[MinIO]
    
    D --> I[Payment Gateways]
    I --> I1[Stripe]
    I --> I2[Paddle]
    
    J[Monitoring System] --> D
    J --> K[Prometheus]
    J --> L[Grafana]
    J --> M[Loki]
    
    subgraph UserEntry [User Entry]
        A
        B
    end
    
    subgraph AppServices [Application Services]
        C
        D
    end
    
    subgraph DataStorage [Data Storage]
        E
        F
    end
    
    subgraph Integrations [Third-party Integrations]
        G
        H
        I
    end
    
    subgraph Monitoring [Monitoring & Operations]
        J
        K
        L
        M
    end
```

## Project Structure

This is a monorepo containing:

```
.
├── packages
│   ├── backend                 # NestJS backend service
│   │   ├── prisma              # Database schema and migrations
│   │   ├── src
│   │   │   ├── ai              # Core AI engine
│   │   │   ├── ai-providers    # Multi-AI provider support
│   │   │   ├── common          # Shared utilities and helpers
│   │   │   ├── conversation    # Chat functionality
│   │   │   ├── generate        # PDF generation
│   │   │   ├── interview       # Interview preparation
│   │   │   ├── job             # Job management
│   │   │   ├── optimization    # Resume optimization
│   │   │   ├── payment         # Payment processing
│   │   │   ├── quota           # Usage quotas
│   │   │   ├── resume          # Resume management
│   │   │   ├── storage         # File storage abstraction
│   │   │   ├── user            # User management
│   │   │   └── ...             # Other modules
│   │   └── ...
│   └── frontend                # React + Vite frontend application
│       ├── src
│       │   ├── components      # Reusable UI components
│       │   ├── pages           # Page components
│       │   ├── services        # API service layer
│       │   ├── stores          # Zustand state management
│       │   └── ...             # Other frontend code
│       └── ...
├── deployment                  # Production deployment configs
├── config                      # Configuration files
└── scripts                     # Utility scripts
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0 (recommended) or npm >= 9.0.0
- PostgreSQL 15+
- Redis 7+
- Docker (optional, for containerized deployment)

> 💡 We recommend using pnpm as the package manager for this project. It provides better disk space efficiency and faster installation times compared to npm or yarn.

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd resume-optimizer
```

2. Install dependencies using pnpm (recommended):

```bash
pnpm install
```

Or using npm:

```bash
npm install
```

### Environment Configuration

Copy and configure environment files:

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env
# Edit with your database, Redis, and AI provider settings

# Frontend
cp packages/frontend/.env.example packages/frontend/.env
# Edit with your API endpoint and other settings
```

### Database Setup

```bash
# Generate Prisma client
cd packages/backend
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# (Optional) Seed initial data
pnpm prisma:seed
```

## Development

### Running the Application

```bash
# Run both frontend and backend in development mode using pnpm (recommended)
pnpm dev

# Or run individually
pnpm dev:backend
pnpm dev:frontend
```

The application will be available at:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3000>
- Swagger Docs: <http://localhost:3000/api/docs>

### Available Scripts

- `pnpm dev` - Start both frontend and backend in development mode (recommended)
- `pnpm build` - Build both packages for production
- `pnpm test` - Run tests in all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm clean` - Clean build artifacts and dependencies

## Testing

### Backend Testing

```bash
cd packages/backend

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:cov
```

### Frontend Testing

```bash
cd packages/frontend

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Deployment

### Docker Deployment (Recommended)

#### Development

```bash
docker-compose up -d
```

#### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

1. Build the applications:

```bash
pnpm build
```

2. Set up environment variables for production:

```bash
cp .env.production .env.production.local
# Edit .env.production.local with production settings
```

3. Start the services:

```bash
# Backend
cd packages/backend
pnpm start:prod

# Frontend (serve the built files with a web server like Nginx)
```

### Production Features

- ✅ PostgreSQL with SSL/TLS encryption
- ✅ Redis with password authentication
- ✅ Multi-cloud object storage support (AWS S3, Aliyun OSS, etc.)
- ✅ Nginx load balancer with SSL termination
- ✅ Automated daily backups
- ✅ Health checks and monitoring
- ✅ Rate limiting and security headers
- ✅ Horizontal scaling support
- ✅ Containerized deployment with Docker

### Production Monitoring

The platform includes comprehensive monitoring capabilities:

- Application metrics with Prometheus
- Centralized logging with Loki
- Visualization dashboards with Grafana
- Real-time log aggregation with Promtail

## API Documentation

Once the backend is running, detailed API documentation is available through Swagger UI:

- <http://localhost:3000/api/docs> (development)
- <https://your-domain.com/api/docs> (production)

The API follows RESTful principles and includes:

- Comprehensive endpoint documentation
- Request/response schemas
- Interactive testing interface
- Authentication flow explanations

## Best Practices & Architecture Guide

This section documents the architectural patterns and configurations used in this project, serving as a reference for building similar enterprise-grade applications.

### Monorepo Structure (Turborepo + pnpm)

```plaintext
resume-optimizer/
├── .github/                    # GitHub Actions & CI/CD
│   ├── workflows/              # Automated workflows (CI, CD, security)
│   ├── ISSUE_TEMPLATE/         # Standardized issue templates
│   ├── dependabot.yml          # Automated dependency updates
│   └── CODEOWNERS              # Code review assignments
├── config/                     # Global configuration files
├── deployment/                 # Production deployment
│   ├── config/                 # Service configurations
│   │   ├── nginx/              # Nginx reverse proxy config
│   │   ├── postgres/           # PostgreSQL config (postgresql.conf, pg_hba.conf)
│   │   ├── redis/              # Redis configuration
│   │   └── ssl/                # SSL certificates
│   ├── scripts/                # Deployment automation scripts
│   │   ├── deploy.sh           # Main deployment orchestrator
│   │   ├── backup-database.sh  # Database backup automation
│   │   ├── restore-database.sh # Database restore script
│   │   └── setup-ssl.sh        # SSL certificate setup
│   └── docker-compose.prod.yml # Production Docker Compose
├── packages/                   # Monorepo packages
│   ├── backend/                # NestJS API service
│   └── frontend/               # React SPA application
├── docker-compose.yml          # Development Docker Compose
├── turbo.json                  # Turborepo task configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
└── package.json                # Root package with workspace scripts
```

### Backend Architecture (NestJS)

The backend follows a **feature-based modular architecture**:

```plaintext
packages/backend/
├── prisma/                     # Database layer
│   ├── schema.prisma           # Data model definitions
│   ├── migrations/             # Version-controlled migrations
│   └── seeds/                  # Seed data scripts
├── src/
│   ├── main.ts                 # Application bootstrap
│   ├── app.module.ts           # Root module with imports
│   ├── ai/                     # Core AI processing engine
│   ├── ai-providers/           # Multi-provider AI abstraction
│   │   ├── config/             # Provider configuration
│   │   ├── providers/          # OpenAI, Qwen, DeepSeek, Gemini, Ollama
│   │   └── services/           # Model selection & fallback logic
│   ├── auth/                   # Authentication (JWT, Passport)
│   ├── common/                 # Shared utilities
│   │   ├── decorators/         # Custom decorators
│   │   ├── filters/            # Exception filters
│   │   ├── guards/             # Auth & permission guards
│   │   ├── interceptors/       # Request/response interceptors
│   │   └── pipes/              # Validation pipes
│   ├── storage/                # Multi-cloud storage abstraction
│   │   └── providers/          # S3, OSS, COS, MinIO implementations
│   ├── payment/                # Payment processing (Stripe, Paddle)
│   ├── monitoring/             # Prometheus metrics & health checks
│   ├── logger/                 # Winston structured logging
│   └── [feature]/              # Feature modules (user, resume, job, etc.)
│       ├── [feature].module.ts
│       ├── [feature].controller.ts
│       ├── [feature].service.ts
│       ├── dto/                # Data transfer objects
│       └── entities/           # Domain entities
└── Dockerfile                  # Multi-stage production build
```

**Key Backend Patterns:**

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **Dependency Injection** | NestJS IoC Container | Loose coupling, testability |
| **Repository Pattern** | Prisma ORM | Database abstraction |
| **Factory Pattern** | AI/Storage Providers | Runtime provider selection |
| **Strategy Pattern** | Payment Processors | Interchangeable algorithms |
| **Decorator Pattern** | Custom Decorators | Cross-cutting concerns |
| **Guard Pattern** | Auth Guards | Request authorization |

### Frontend Architecture (React + Vite)

```plaintext
packages/frontend/
├── src/
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root component with routing
│   ├── components/             # Reusable UI components
│   │   ├── common/             # Generic components
│   │   └── [feature]/          # Feature-specific components
│   ├── pages/                  # Route page components
│   ├── layouts/                # Page layout templates
│   ├── services/               # API client layer
│   │   ├── api.ts              # Axios instance configuration
│   │   └── [feature].service.ts
│   ├── stores/                 # Zustand state management
│   │   └── [feature]Store.ts
│   ├── router/                 # React Router configuration
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── vite.config.ts              # Vite build configuration
└── Dockerfile                  # Nginx static file serving
```

### Docker Multi-Stage Builds (Best Practice)

```dockerfile
# Stage 1: Pruning (Turborepo)
FROM node:20-alpine AS pruner
RUN pnpm dlx turbo prune --scope=@package/name

# Stage 2: Building
FROM node:20-alpine AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm run build

# Stage 3: Runtime (minimal image)
FROM node:20-alpine AS runner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

### CI/CD Pipeline Structure

```plaintext
.github/workflows/
├── ci.yml                      # Continuous Integration
│   ├── Lint & Format Check
│   ├── Build Verification
│   ├── Unit & Integration Tests
│   └── Security Scanning
├── cd.yml                      # Continuous Deployment
│   ├── Build Docker Images
│   ├── Push to Registry
│   └── Deploy to Environment
├── release.yml                 # Semantic Versioning
└── security.yml                # Security Audits (CodeQL, Dependabot)
```

### Configuration Management

| Environment | Files | Purpose |
|-------------|-------|---------|
| Development | `.env`, `docker-compose.yml` | Local development |
| Production | `.env.production`, `deployment/docker-compose.prod.yml` | Production deployment |
| Example | `.env.example`, `.env.production.example` | Template for new setups |

### Recommended Tools & Versions

| Category | Tool | Version | Purpose |
|----------|------|---------|---------|
| **Runtime** | Node.js | ≥20.x | LTS with modern features |
| **Package Manager** | pnpm | ≥9.x | Efficient disk usage |
| **Build Orchestration** | Turborepo | ≥2.x | Monorepo task caching |
| **Database** | PostgreSQL | ≥15 | Primary data store |
| **Cache** | Redis | ≥7 | Session & API caching |
| **Containerization** | Docker | ≥24 | Application packaging |

### Security Best Practices

1. **Environment Variables**: Never commit secrets; use `.env.example` templates
2. **CORS Configuration**: Whitelist specific origins in production
3. **Rate Limiting**: Apply per-endpoint limits to prevent abuse
4. **Input Validation**: Use `class-validator` DTOs for all inputs
5. **SQL Injection**: Prisma ORM provides parameterized queries
6. **XSS Protection**: Helmet middleware for security headers
7. **Dependency Scanning**: Dependabot + CodeQL automated scanning

### Quick Start Template

To use this architecture for a new project:

```bash
# 1. Initialize monorepo
mkdir my-project && cd my-project
pnpm init
echo 'packages:\n  - "packages/*"' > pnpm-workspace.yaml

# 2. Create packages
mkdir -p packages/{backend,frontend}

# 3. Initialize Turborepo
pnpm add -Dw turbo
# Copy turbo.json configuration

# 4. Setup CI/CD
mkdir -p .github/workflows
# Copy workflow templates

# 5. Setup deployment
mkdir -p deployment/{config,scripts}
# Copy Docker Compose and scripts
```

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

Private
