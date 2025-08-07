import { create } from "zustand";

interface SearchState {
  // 검색 조건
  keyword: string;
  category: string;
  sort: string;
  startDate: Date | null;
  endDate: Date | null;
  period: string;
  searchRange: string;

  // 히스토리 태그
  historyTags: string[];

  setKeyword: (value: string) => void;
  setCategory: (value: string) => void;
  setSort: (value: string) => void;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  setPeriod: (value: string) => void;
  setSearchRange: (value: string) => void;

  addHistoryTag: (tag: string) => void;
  removeHistoryTag: (tag: string) => void;
  clearHistoryTags: () => void;

  resetSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  keyword: "",
  category: "",
  sort: "latest",
  startDate: null,
  endDate: null,
  period: "",
  searchRange: "title_content",
  historyTags: [],

  setKeyword: (value) => set({ keyword: value }),
  setCategory: (value) => set({ category: value }),
  setSort: (value) => set({ sort: value }),
  setStartDate: (date) => set({ startDate: date }),
  setEndDate: (date) => set({ endDate: date }),
  setPeriod: (value) => set({ period: value }),
  setSearchRange: (value: string) => set({ searchRange: value }),

  addHistoryTag: (tag) =>
    set((state) => {
      if (!tag.trim()) return state;
      const newTags = [tag, ...state.historyTags.filter((t) => t !== tag)];
      return { historyTags: newTags.slice(0, 10) };
    }),

  removeHistoryTag: (tag) =>
    set((state) => ({
      historyTags: state.historyTags.filter((t) => t !== tag),
    })),

  clearHistoryTags: () => set({ historyTags: [] }),

  resetSearch: () =>
    set({
      keyword: "",
      category: "",
      sort: "latest",
      startDate: null,
      endDate: null,
      period: "",
      searchRange: "title_content",
      historyTags: [],
    }),
}));