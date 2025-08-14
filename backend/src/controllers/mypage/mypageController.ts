import { Request, Response } from 'express';

// 데이터의 타입을 명확하게 정의합니다.
interface ProfileData {
    nickname: string;
    email: string;
    phone: string;
    joinDate: string;
    id: string;
}

interface Article {
    id: number;
    title: string;
    link: string;
    publisher?: string;
    status?: 'liked' | 'unliked';
    likesCount?: number;
}

interface RatingHistoryItem {
    id: number;
    title: string;
    link: string;
    rating: number;
    date: string;
}

// 모의 데이터베이스
const mockDB = {
    profile: {
        nickname: "김동희",
        email: "donghee@example.com",
        phone: "010-1234-5678",
        joinDate: "2023-01-01",
        id: "donghee290"
    },
    bookmarks: [
        { id: 1, title: "북마크한 뉴스 1", link: "...", publisher: "조선일보" },
        // ...
    ],
    ratings: [
        { id: 101, title: "별점 평가 기사 1", link: "...", rating: 5, date: "2025-08-13" },
        // ...
    ],
    likes: [
        { id: 201, title: "좋아요 기사 1", link: "...", likesCount: 10, status: 'liked' },
        // ...
    ],
};

// 프로필 정보를 가져오는 컨트롤러 함수
export const getProfile = (req: Request, res: Response) => {
    res.json(mockDB.profile);
};

// 북마크 목록을 가져오는 컨트롤러 함수
export const getBookmarks = (req: Request, res: Response) => {
    res.json(mockDB.bookmarks);
};

// 별점 평가 내역을 가져오는 컨트롤러 함수
export const getRatings = (req: Request, res: Response) => {
    res.json(mockDB.ratings);
};

// 좋아요 기사 목록을 가져오는 컨트롤러 함수
export const getLikes = (req: Request, res: Response) => {
    res.json(mockDB.likes);
};

// 프로필 정보를 업데이트하는 컨트롤러 함수
export const updateProfile = (req: Request, res: Response) => {
    // 실제로는 데이터베이스에 저장하는 로직이 들어갑니다.
    const { nickname, email, phone } = req.body;
    
    // 모의 DB 업데이트
    if (nickname) mockDB.profile.nickname = nickname;
    if (email) mockDB.profile.email = email;
    if (phone) mockDB.profile.phone = phone;

    res.status(200).json({ message: "프로필이 성공적으로 업데이트되었습니다." });
};

// 비밀번호를 변경하는 컨트롤러 함수 (휴대폰 인증 로직은 생략)
export const changePassword = (req: Request, res: Response) => {
    // 실제로는 기존 비밀번호 확인, 새 비밀번호 암호화 후 DB에 저장하는 로직이 들어갑니다.
    res.status(200).json({ message: "비밀번호가 성공적으로 변경되었습니다." });
};

// 로그아웃을 처리하는 컨트롤러 함수
export const logoutUser = (req: Request, res: Response) => {
    // 실제로는 세션 또는 JWT 토큰을 무효화하는 로직이 들어갑니다.
    res.status(200).json({ message: "로그아웃이 성공적으로 처리되었습니다." });
};

// 회원 탈퇴를 처리하는 컨트롤러 함수
export const withdrawUser = (req: Request, res: Response) => {
    // 실제로는 사용자 계정을 비활성화하거나 삭제하는 로직이 들어갑니다.
    res.status(200).json({ message: "회원 탈퇴가 성공적으로 처리되었습니다." });
};