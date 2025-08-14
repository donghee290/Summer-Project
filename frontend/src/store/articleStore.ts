// frontend/src/store/articleStore.ts
import { create } from 'zustand';
import type {
  Article,
  ArticleListItem,
  UserInteractions,
  ArticleListResponse,
  ArticleDetailResponse,
} from '../api/article/articleApi';
import {
  getArticles,
  getArticleById,
  toggleBookmark as apiToggleBookmark,
  toggleLike as apiToggleLike,
  addRating as apiAddRating,
  getUserBookmarks,
} from '../api/article/articleApi';

// ---- Public store shape used by components ----
interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ArticleState {
  // 목록/페이지네이션
  list: ArticleListItem[];
  pagination: PaginationState;

  // 상세
  detail?: Article;
  interactions?: UserInteractions;

  // 공통 상태
  loading: boolean;
  error?: string;

  // Actions (컴포넌트에서 사용하는 이름에 맞춤)
  loadList: (page?: number, limit?: number) => Promise<void>;
  loadDetail: (id: number) => Promise<void>;
  toggleBookmark: (id?: number) => Promise<void>;
  toggleLike: (id?: number) => Promise<void>;
  rate: (rating: number, id?: number) => Promise<void>;

  // Reset helpers
  resetList: () => void;
  resetDetail: () => void;

  // (옵션) 내 북마크 목록 – 필요 시 사용
  bookmarks: ArticleListItem[];
  loadMyBookmarks: (page?: number, limit?: number) => Promise<void>;

  // Backward-compat aliases (기존 이름으로 부르는 코드가 있다면 동작하도록)
  fetchArticles?: (page?: number, limit?: number) => Promise<void>;
  fetchArticleById?: (id: number) => Promise<void>;
  toggleBookmarkCurrent?: (id?: number) => Promise<void>;
  toggleLikeCurrent?: (id?: number) => Promise<void>;
  rateCurrent?: (rating: number, id?: number) => Promise<void>;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  // ===== 기본 상태 =====
  list: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },

  detail: undefined,
  interactions: undefined,

  loading: false,
  error: undefined,

  bookmarks: [],

  // ===== 목록 불러오기 =====
  loadList: async (page = get().pagination.page, limit = get().pagination.limit) => {
    try {
      set({ loading: true, error: undefined });
      const res: ArticleListResponse = await getArticles(page, limit);
      set({
        list: res.data.articles ?? [],
        pagination: {
          page: res.data.pagination.page,
          limit: res.data.pagination.limit,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
        },
      });
    } catch (e: any) {
      set({ error: e?.message || '기사 목록을 불러오지 못했습니다.' });
    } finally {
      set({ loading: false });
    }
  },

  resetList: () => {
    set({
      list: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      error: undefined,
    });
  },

  // ===== 상세 불러오기 =====
  loadDetail: async (id: number) => {
    try {
      set({ loading: true, error: undefined, detail: undefined, interactions: undefined });
      const res: ArticleDetailResponse = await getArticleById(id);
      const article = Array.isArray(res.data.article) ? res.data.article[0] : undefined;
      set({
        detail: article,
        interactions: res.data.userInteractions,
      });
    } catch (e: any) {
      set({ error: e?.message || '기사 상세를 불러오지 못했습니다.' });
    } finally {
      set({ loading: false });
    }
  },

  resetDetail: () => {
    set({ detail: undefined, interactions: undefined, error: undefined });
  },

  // ===== 상호작용(상세 기준) =====
  toggleBookmark: async (id) => {
    const state = get();
    const targetId = id ?? state.detail?.article_no;
    if (!targetId) return;

    const prevInteractions = state.interactions;
    if (!prevInteractions) return;

    const nextBookmarked = !prevInteractions.bookmarked;
    set({ interactions: { ...prevInteractions, bookmarked: nextBookmarked } });

    try {
      await apiToggleBookmark(targetId);
    } catch (e) {
      // 롤백
      set({ interactions: prevInteractions, error: '북마크 처리 중 오류가 발생했습니다.' });
    }
  },

  toggleLike: async (id) => {
    const state = get();
    const targetId = id ?? state.detail?.article_no;
    if (!targetId) return;

    const prevInteractions = state.interactions;
    const prevArticle = state.detail;
    if (!prevInteractions || !prevArticle) return;

    const nextLiked = !prevInteractions.liked;
    const delta = nextLiked ? 1 : -1;

    const prevCount = prevArticle.article_like_count ?? 0;
    const optimisticArticle: Article = {
      ...prevArticle,
      article_like_count: Math.max(0, prevCount + delta),
    };

    // 낙관적 업데이트
    set({
      interactions: { ...prevInteractions, liked: nextLiked },
      detail: optimisticArticle,
    });

    try {
      const res = await apiToggleLike(targetId);
      if (typeof (res as any).likeCount === 'number') {
        set({
          detail: {
            ...get().detail!,
            article_like_count: (res as any).likeCount,
          },
        });
      }
    } catch (e) {
      // 롤백
      set({ interactions: prevInteractions, detail: prevArticle, error: '좋아요 처리 중 오류가 발생했습니다.' });
    }
  },

  rate: async (rating, id) => {
    const state = get();
    const targetId = id ?? state.detail?.article_no;
    if (!targetId) return;

    const prevInteractions = state.interactions;
    const prevArticle = state.detail;

    if (prevInteractions) {
      set({ interactions: { ...prevInteractions, rated: true, userRating: rating } });
    }

    try {
      const res = await apiAddRating(targetId, rating);
      if ((res as any).data) {
        const { avgRating } = (res as any).data;
        if (prevArticle) {
          set({
            detail: {
              ...prevArticle,
              article_rating_avg:
                typeof avgRating === 'number' ? avgRating : prevArticle.article_rating_avg ?? null,
            },
          });
        }
      }
    } catch (e) {
      if (prevInteractions) set({ interactions: prevInteractions });
      set({ error: '별점 처리 중 오류가 발생했습니다.' });
    }
  },

  // ===== 내 북마크 목록 (옵션) =====
  loadMyBookmarks: async (page = 1, limit = 20) => {
    try {
      set({ loading: true, error: undefined });
      const res = await getUserBookmarks(page, limit);
      set({ bookmarks: res.data.articles ?? [] });
    } catch (e: any) {
      set({ error: e?.message || '북마크 목록을 불러오지 못했습니다.' });
    } finally {
      set({ loading: false });
    }
  },

  // ===== Aliases for backward compatibility =====
  fetchArticles: async (page?: number, limit?: number) => get().loadList(page, limit),
  fetchArticleById: async (id: number) => get().loadDetail(id),
  toggleBookmarkCurrent: async (id?: number) => get().toggleBookmark(id),
  toggleLikeCurrent: async (id?: number) => get().toggleLike(id),
  rateCurrent: async (rating: number, id?: number) => get().rate(rating, id),
}));