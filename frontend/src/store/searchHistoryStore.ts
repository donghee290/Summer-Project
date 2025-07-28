import { create } from 'zustand';

interface SearchHistoryState {
  history: string[];
  addHistory: (keyword: string) => void;
  removeHistory: (keyword: string) => void;
  clearHistory: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set) => ({
  history: [],
  addHistory: (keyword) =>
    set((state) => {
      const newHistory = [keyword, ...state.history.filter((k) => k !== keyword)];
      return {
        history: newHistory.slice(0, 10),
      };
    }),
  removeHistory: (keyword) =>
    set((state) => ({
      history: state.history.filter((k) => k !== keyword),
    })),
  clearHistory: () => set({ history: [] }),
}));