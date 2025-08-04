import axios from '../axiosInstance';

export interface SearchQuery {
  keyword: string;
  category?: string;
  sort?: 'latest' | 'popular' | 'rating';
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
}

export interface SearchResponse {
  total: number;
  results: SearchResultItem[];
}

export const searchContent = async (
  query: SearchQuery
): Promise<SearchResponse> => {
  const res = await axios.get('/search', {
    params: query,
  });
  return res.data;
};

export const fetchSearchDetail = async (
  id: string
): Promise<SearchResultItem> => {
  const res = await axios.get(`/search/${id}`);
  return res.data;
};