// frontend/src/api/article/articleApi.ts
import axios from '../axiosInstance';

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