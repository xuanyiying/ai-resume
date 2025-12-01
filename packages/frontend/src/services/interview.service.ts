import axios from '../config/axios';

export interface InterviewSession {
  id: string;
  userId: string;
  optimizationId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startTime: string;
  endTime?: string;
  score?: number;
  feedback?: string;
  messages?: InterviewMessage[];
}

export interface InterviewMessage {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  audioUrl?: string;
  createdAt: string;
}

export const interviewService = {
  startSession: async (optimizationId: string) => {
    const response = await axios.post<InterviewSession>('/interview/session', {
      optimizationId,
    });
    return response.data;
  },

  sendMessage: async (
    sessionId: string,
    content: string,
    audioUrl?: string
  ) => {
    const response = await axios.post<{
      userMessage: InterviewMessage;
      aiMessage: InterviewMessage;
    }>(`/interview/session/${sessionId}/message`, {
      content,
      audioUrl,
    });
    return response.data;
  },

  endSession: async (sessionId: string) => {
    const response = await axios.post<InterviewSession>(
      `/interview/session/${sessionId}/end`
    );
    return response.data;
  },

  uploadAudio: async (file: Blob) => {
    const formData = new FormData();
    formData.append('file', file, 'recording.webm');
    formData.append('fileType', 'AUDIO');
    formData.append('category', 'interview_recording');

    const response = await axios.post<{ url: string }>(
      '/storage/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await axios.get<InterviewSession>(
      `/interview/session/${sessionId}`
    );
    return response.data;
  },

  getActiveSession: async (optimizationId: string) => {
    const response = await axios.get<InterviewSession | null>(
      `/interview/active-session/${optimizationId}`
    );
    return response.data;
  },
};
