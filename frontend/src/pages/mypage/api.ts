import axios from 'axios';
import { ProfileData, Article, RatingHistoryItem } from './MyPageTypes';

// 백엔드 서버의 기본 URL을 정의합니다. (backend 폴더에 있는 서버 주소)
const API_BASE_URL = 'http://localhost:3001/api';

// 프로필 정보를 가져오는 함수
export const fetchProfileInfo = async (): Promise<ProfileData> => {
    const response = await axios.get<ProfileData>(`${API_BASE_URL}/profile`);
    return response.data;
};

// 북마크한 뉴스를 가져오는 함수
export const fetchBookmarkedNews = async (): Promise<Article[]> => {
    const response = await axios.get<Article[]>(`${API_BASE_URL}/bookmarks`);
    return response.data;
};

// 별점 평가 내역을 가져오는 함수
export const fetchRatingHistory = async (): Promise<RatingHistoryItem[]> => {
    const response = await axios.get<RatingHistoryItem[]>(`${API_BASE_URL}/ratings`);
    return response.data;
};

// 좋아요 기사를 가져오는 함수
export const fetchLikedArticles = async (): Promise<Article[]> => {
    const response = await axios.get<Article[]>(`${API_BASE_URL}/likes`);
    return response.data;
};