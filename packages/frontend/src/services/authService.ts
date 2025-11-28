import axios from '../config/axios';

export interface RegisterData {
  email: string;
  password: string;
  username?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username?: string;
    subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE';
  };
  token?: string;
  accessToken?: string;
}

export const authService = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await axios.post('/auth/register', data);
    // Map accessToken to token if needed
    if (response.data.accessToken && !response.data.token) {
      response.data.token = response.data.accessToken;
    }
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await axios.post('/auth/login', data);
    // Map accessToken to token if needed
    if (response.data.accessToken && !response.data.token) {
      response.data.token = response.data.accessToken;
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    await axios.post('/auth/logout');
  },

  getCurrentUser: async () => {
    const response = await axios.get('/auth/me');
    return response.data;
  },

  verifyEmail: async (token: string): Promise<void> => {
    await axios.post('/auth/verify-email', { token });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await axios.post('/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await axios.post('/auth/reset-password', { token, newPassword });
  },

  verifyToken: async (token: string) => {
    // Set the token in the authorization header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      // Get current user info to verify the token
      const response = await axios.get('/auth/me');
      return response.data;
    } finally {
      // Clean up the authorization header
      delete axios.defaults.headers.common['Authorization'];
    }
  },
};
