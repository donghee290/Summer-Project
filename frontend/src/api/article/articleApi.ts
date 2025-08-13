import axios from '../axiosInstance';

// ===== 타입 정의 =====
// 일부 필드를 optional/nullable로 조정
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
  article_like_count?: number;          // 서버가 안 줄 수도 있어 optional
  article_rating_avg?: number | null;   // 평균이 없을 때 null 가능
  article_view_count?: number;
}

export interface ArticleListItem {
  article_no: number;
  article_title: string;
  article_summary: string;
  article_category: string;
  article_press?: string | null;
  article_reg_at: string;
  avg_rating?: number | null;           // null/미제공 가능성
  likes_count?: number;
}

export interface UserInteractions {
  bookmarked: boolean;
  liked: boolean;
  rated: boolean;
  userRating: number | null;
}

// 그대로 OK
export interface ArticleDetailResponse {
  success: boolean;
  data: {
    article: Article[]; // 단건이어도 배열로 오는 케이스 대응
    userInteractions: UserInteractions;
  };
}

// 그대로 OK
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
  message?: string;        // 메시지 항상 오지 않으면 optional
  bookmarked: boolean;
}

export interface LikeResponse {
  success: boolean;
  message?: string;
  liked: boolean;
  likeCount?: number;      // 서버가 주면 사용
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
export const getArticles = async (
  page: number = 1, 
  limit: number = 20
): Promise<ArticleListResponse> => {
  const response = await axios.get('/api/articles', {
    params: { page, limit }
  });
  return response.data;
};

export const getArticleById = async (
  id: number
): Promise<ArticleDetailResponse> => {
  const response = await axios.get(`/api/articles/${id}`);
  return response.data;
};

export const toggleBookmark = async (
  id: number
): Promise<BookmarkResponse> => {
  const response = await axios.post(`/api/articles/${id}/bookmark`);
  return response.data;
};

export const toggleLike = async (
  id: number
): Promise<LikeResponse> => {
  const response = await axios.post(`/api/articles/${id}/like`);
  return response.data;
};

export const addRating = async (
  id: number, 
  rating: number
): Promise<RatingResponse> => {
  const response = await axios.post(`/api/articles/${id}/rating`, { rating });
  return response.data;
};

export const getUserBookmarks = async (
  page: number = 1, 
  limit: number = 20
): Promise<ArticleListResponse> => {
  const response = await axios.get('/api/articles/bookmarks/my', {
    params: { page, limit }
  });
  return response.data;
};

export const searchArticles = async (
  keyword?: string,
  category?: string,
  page: number = 1,
  limit: number = 20
): Promise<ArticleListResponse> => {
  const response = await axios.get('/api/articles/search', {
    params: { keyword, category, page, limit }
  });
  return response.data;
};
