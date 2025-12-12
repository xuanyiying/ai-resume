import axios from '../config/axios';
import { ParsedResumeData } from '../types';

/**
 * Pitch Perfect Agent Service
 */
export const pitchPerfectService = {
  generatePitch: async (
    resumeData: ParsedResumeData,
    jobDescription: string,
    style: 'technical' | 'managerial' | 'sales',
    duration: 30 | 60
  ) => {
    const response = await axios.post('/api/agents/pitch-perfect/generate', {
      resumeData,
      jobDescription,
      style,
      duration,
    });
    return response.data;
  },

  refinePitch: async (
    currentIntroduction: string,
    feedback: string
  ) => {
    const response = await axios.post('/api/agents/pitch-perfect/refine', {
      currentIntroduction,
      feedback,
    });
    return response.data;
  },
};

/**
 * Strategist Agent Service
 */
export const strategistService = {
  generateQuestionBank: async (
    resumeData: ParsedResumeData,
    jobDescription: string,
    experienceLevel: 'junior' | 'mid' | 'senior'
  ) => {
    const response = await axios.post('/api/agents/strategist/generate', {
      resumeData,
      jobDescription,
      experienceLevel,
    });
    return response.data;
  },

  updateBasedOnPerformance: async (performance: any) => {
    const response = await axios.post(
      '/api/agents/strategist/update-performance',
      { performance }
    );
    return response.data;
  },
};

/**
 * Role-Play Agent Service
 */
export const rolePlayService = {
  startInterview: async (
    jobDescription: string,
    interviewerStyle: 'strict' | 'friendly' | 'stress-test',
    focusAreas: string[],
    resumeData?: ParsedResumeData
  ) => {
    const response = await axios.post('/api/agents/role-play/start', {
      jobDescription,
      interviewerStyle,
      focusAreas,
      resumeData,
    });
    return response.data;
  },

  processResponse: async (sessionId: string, userResponse: string) => {
    const response = await axios.post('/api/agents/role-play/respond', {
      sessionId,
      userResponse,
    });
    return response.data;
  },

  concludeInterview: async (sessionId: string) => {
    const response = await axios.post('/api/agents/role-play/conclude', {
      sessionId,
    });
    return response.data;
  },

  getFeedback: async (sessionId: string) => {
    const response = await axios.get(`/api/agents/role-play/feedback/${sessionId}`);
    return response.data;
  },
};

/**
 * Agent Metrics Service
 */
export const agentMetricsService = {
  getTokenUsageReport: async (
    startDate: string,
    endDate: string,
    groupBy: 'agent-type' | 'workflow-step' | 'model' = 'agent-type',
    agentType?: string
  ) => {
    const response = await axios.get('/api/agents/metrics/token-usage', {
      params: {
        startDate,
        endDate,
        groupBy,
        ...(agentType && { agentType }),
      },
    });
    return response.data;
  },

  getCostReport: async (
    startDate: string,
    endDate: string,
    groupBy: 'agent-type' | 'workflow-step' | 'model' = 'agent-type',
    agentType?: string
  ) => {
    const response = await axios.get('/api/agents/metrics/cost', {
      params: {
        startDate,
        endDate,
        groupBy,
        ...(agentType && { agentType }),
      },
    });
    return response.data;
  },

  getOptimizationSavingsReport: async (
    startDate: string,
    endDate: string,
    agentType?: string
  ) => {
    const response = await axios.get('/api/agents/metrics/optimization-savings', {
      params: {
        startDate,
        endDate,
        ...(agentType && { agentType }),
      },
    });
    return response.data;
  },
};
