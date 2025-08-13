// frontend/src/pages/mypage/MyPageTypes.ts

// 프로필 데이터 타입 정의
export interface ProfileData {
    nickname: string;
    email: string;
    phone: string;
    joinDate: string;
    id: string;
}

// 뉴스 기사 타입 정의 (북마크, 좋아요 기사 공통)
export interface Article {
    id: number;
    title: string;
    link: string;
    publisher?: string;
    status?: 'liked' | 'unliked';
    likesCount?: number;
}

// 별점 평가 내역 타입 정의
export interface RatingHistoryItem {
    id: number;
    title: string;
    link: string;
    rating: number;
    date: string;
}