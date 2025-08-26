import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isLoggedIn: boolean;
  token: string;
  refreshToken: string;
  setToken: (token: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      token: '',
      refreshToken: '',
      setToken: (token: string) =>
        set({ token, isLoggedIn: true }),
      setTokens: (accessToken: string, refreshToken: string) =>
        set({ token: accessToken, refreshToken, isLoggedIn: true }),
      logout: () =>
        set({ token: '', refreshToken: '', isLoggedIn: false }),
    }),
    {
      name: 'auth-storage', // localStorage 키 이름
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, isLoggedIn: state.isLoggedIn }),
    }
  )
);