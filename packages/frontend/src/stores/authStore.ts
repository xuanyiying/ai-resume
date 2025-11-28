import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from '../config/axios';

interface User {
  id: string;
  email: string;
  username?: string;
  avatar?: string;
  subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE';
  role?: 'USER' | 'ADMIN';
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false });
      },
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
      refreshProfile: async () => {
        try {
          const response = await axios.get('/auth/profile');
          set((state) => ({
            user: { ...state.user, ...response.data },
          }));
        } catch (error) {
          console.error('Failed to refresh profile:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
