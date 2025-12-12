/**
 * Workflow interfaces for Agent orchestration
 */

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

export interface WorkflowContext {
  userId: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface WorkflowResult {
  success: boolean;
  results: any[];
  tokenUsage: {
    total: number;
    byStep: Record<string, number>;
  };
  duration?: number;
  error?: string;
}
