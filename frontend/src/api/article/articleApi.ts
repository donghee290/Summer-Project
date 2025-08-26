// frontend/src/api/article/articleApi.ts
import axios from '../axiosInstance';

// ===== 추가 타입 (Top3/필터링 지원) =====
export type TopCategory = '국내경제' | '해외경제' | '사회' | '트렌드';

export interface ArticleListQuery {
  topCategory?: TopCategory;        // 상단 탭 필터
  dateFrom?: string;                // ISO(+09:00) — 어제 00:00:00
  dateTo?: string;                  // ISO(+09:00) — 오늘 00:00:00
  lines?: 1 | 2 | 3;                // 세 줄 요약 등
  sort?: 'latest' | 'popular';
  page?: number;
  limit?: number;
}

export interface Top3Issue {
  article_no: number;          // 대표 아티클 ID (클릭 이동)
  headline: string;            // 한 줄 요약 텍스트
  frequency: number;           // 빈도(동일/유사 기사 수)
  top_category: TopCategory;
}

export interface Top3Query {
  topCategory: TopCategory;
  dateFrom: string;
  dateTo: string;
}

// ===== 타입 정의 =====
export interface Article {
  article_no: number;
  article_title: string;
  article_summary: string;
  article_content: string;
  article_category: string;
  article_press?: string | null;
  article_source?: string | null;
  article_reg_at: string;
  article_update_at?: string | null;
  article_like_count?: number;
  article_rating_avg?: number | null;
  article_view_count?: number;
}

export interface ArticleListItem {
  article_no: number;
  article_title: string;
  article_summary: string;
  article_category: string;
  article_press?: string | null;
  article_reg_at: string;
  avg_rating?: number | null;
  likes_count?: number;
}

export interface UserInteractions {
  bookmarked: boolean;
  liked: boolean;
  rated: boolean;
  userRating: number | null;
}

export interface ArticleDetailResponse {
  success: boolean;
  data: {
    article: Article[]; // 단건이어도 배열 대응
    userInteractions: UserInteractions;
  };
}

export interface ArticleListResponse {
  success: boolean;
  data: {
    articles: ArticleListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface Top3Response {
  success: boolean;
  data: { items: Top3Issue[] };
}

export interface BookmarkResponse {
  success: boolean;
  message?: string;
  bookmarked: boolean;
}

export interface LikeResponse {
  success: boolean;
  message?: string;
  liked: boolean;
  likeCount?: number;
}

export interface RatingResponse {
  success: boolean;
  message?: string;
  data?: {
    userRating: number;
    avgRating: number;
    ratingCount: number;
  };
}

// ===== API 함수들 =====
// 백엔드: app.use("/api", articleRouter);
// router.get('/articles', ...);
export const getArticles = async (
  page: number = 1,
  limit: number = 20
): Promise<ArticleListResponse> => {
  const response = await axios.get('/articles', { params: { page, limit } });
  return response.data;
};

// 백엔드: router.get('/articles/:id', ...);
export const getArticleById = async (id: number): Promise<ArticleDetailResponse> => {
  const response = await axios.get(`/articles/${id}`);
  return response.data;
};

// 백엔드: router.post('/articles/:id/bookmark', verifyToken, ...);
// 토큰은 axios 인터셉터로 자동 주입되므로 인자 1개만 받습니다.
export const toggleBookmark = async (id: number): Promise<BookmarkResponse> => {
  const response = await axios.post(`/articles/${id}/bookmark`);
  return response.data;
};

// 백엔드: router.post('/articles/:id/like', verifyToken, ...);
export const toggleLike = async (id: number): Promise<LikeResponse> => {
  const response = await axios.post(`/articles/${id}/like`);
  return response.data;
};

// 백엔드: router.post('/articles/:id/rating', verifyToken, ...);
export const addRating = async (id: number, rating: number): Promise<RatingResponse> => {
  const response = await axios.post(`/articles/${id}/rating`, { rating });
  return response.data;
};

// 백엔드: router.get('/articles/bookmarks/my', verifyToken, ...);
export const getUserBookmarks = async (
  page: number = 1,
  limit: number = 20
): Promise<ArticleListResponse> => {
  const response = await axios.get('/articles/bookmarks/my', { params: { page, limit } });
  return response.data;
};

// 백엔드: router.get('/articles/search', ...);
export const searchArticles = async (
  keyword?: string,
  category?: string,
  page: number = 1,
  limit: number = 20
): Promise<ArticleListResponse> => {
  const response = await axios.get('/articles/search', {
    params: { keyword, category, page, limit },
  });
  return response.data;
};

// 확장: 필터형 목록 조회 (기존 getArticles는 유지)
export const getArticlesFiltered = async (
  query: ArticleListQuery
): Promise<ArticleListResponse> => {
  const params = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    topCategory: query.topCategory,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    lines: query.lines,
    sort: query.sort,
  };
  const response = await axios.get('/articles', { params });
  return response.data;
};

// 어제의 카테고리별 Top3 이슈(한 줄 요약)
export const getTop3Issues = async (
  q: Top3Query
): Promise<Top3Issue[]> => {
  const response = await axios.get<Top3Response>('/articles/top3', { params: q });
  return response.data.data.items;
};