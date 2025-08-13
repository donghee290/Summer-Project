import axios from '../axiosInstance';

export interface SearchQuery {
  keyword: string;
  category?: string;
  sort?: 'latest' | 'popular' | 'rating';
  searchRange?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  thumbnailUrl?: string;
  rating?: number;
  likes?: number;
}

export interface SearchResponse {
  total: number;
  results: SearchResultItem[];
}

export const searchContent = async (
  query: SearchQuery
): Promise<SearchResponse> => {
  const page = query.page ?? 1;
  const size = query.size ?? 10;

  const res = await axios.get('/search', {
    params: {
      keyword: query.keyword,
      category: query.category,
      sort: query.sort,
      searchRange: query.searchRange,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: size,
      offset: (page - 1) * size
    }
  });

  const mappedResults: SearchResultItem[] = res.data.results.map((item: any) => ({
    id: String(item.article_no),
    title: item.article_title,
    summary: item.article_summary,
    category: item.article_category,
    date: item.article_reg_at,
    rating: item.article_rate_avg,
    likes: item.article_like_count,
    thumbnailUrl: item.article_image ? `/uploads/${item.article_image}` : undefined
  }));

  return {
    total: mappedResults.length,
    results: mappedResults
  };
};

export const fetchSearchDetail = async (
  id: string
): Promise<SearchResultItem> => {
  const res = await axios.get(`/search/${id}`);
  return res.data;
};