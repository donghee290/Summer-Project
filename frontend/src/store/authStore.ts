import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isLoggedIn: boolean;
  token: string;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      token: '',
      setToken: (token: string) =>
        set({ token, isLoggedIn: true }),
      logout: () =>
        set({ token: '', isLoggedIn: false }),
    }),
    {
      name: 'auth-storage', // localStorage 키 이름
      partialize: (state) => ({ token: state.token, isLoggedIn: state.isLoggedIn }),
    }
  )
);