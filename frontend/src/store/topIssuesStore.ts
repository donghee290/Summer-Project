import { create } from "zustand";
import { getTop3Issues, Top3Issue, TopCategory } from "../api/article/articleApi";
import { getYesterdayKSTRange } from "../utils/dateRange";

type State = {
  byCat: Partial<Record<TopCategory, Top3Issue[]>>;
  loading: boolean;
  error: string | null;
  dateFrom?: string;
  dateTo?: string;
};
type Actions = {
  loadYesterdayTop3: (cat: TopCategory) => Promise<void>;
};

export const useTopIssuesStore = create<State & Actions>((set, get) => ({
  byCat: {},
  loading: false,
  error: null,
  async loadYesterdayTop3(cat) {
    const { dateFrom, dateTo } = getYesterdayKSTRange();
    set({ loading: true, error: null, dateFrom, dateTo });
    try {
      const items = await getTop3Issues({ topCategory: cat, dateFrom, dateTo });
      set(s => ({ byCat: { ...s.byCat, [cat]: items }, loading: false }));
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "failed to load top3" });
    }
  },
}));