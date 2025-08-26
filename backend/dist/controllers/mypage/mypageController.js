"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawUser = exports.logoutUser = exports.changePassword = exports.updateProfile = exports.getLikes = exports.getRatings = exports.getBookmarks = exports.getProfile = void 0;
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
const getProfile = (req, res) => {
    res.json(mockDB.profile);
};
exports.getProfile = getProfile;
// 북마크 목록을 가져오는 컨트롤러 함수
const getBookmarks = (req, res) => {
    res.json(mockDB.bookmarks);
};
exports.getBookmarks = getBookmarks;
// 별점 평가 내역을 가져오는 컨트롤러 함수
const getRatings = (req, res) => {
    res.json(mockDB.ratings);
};
exports.getRatings = getRatings;
// 좋아요 기사 목록을 가져오는 컨트롤러 함수
const getLikes = (req, res) => {
    res.json(mockDB.likes);
};
exports.getLikes = getLikes;
// 프로필 정보를 업데이트하는 컨트롤러 함수
const updateProfile = (req, res) => {
    // 실제로는 데이터베이스에 저장하는 로직이 들어갑니다.
    const { nickname, email, phone } = req.body;
    // 모의 DB 업데이트
    if (nickname)
        mockDB.profile.nickname = nickname;
    if (email)
        mockDB.profile.email = email;
    if (phone)
        mockDB.profile.phone = phone;
    res.status(200).json({ message: "프로필이 성공적으로 업데이트되었습니다." });
};
exports.updateProfile = updateProfile;
// 비밀번호를 변경하는 컨트롤러 함수 (휴대폰 인증 로직은 생략)
const changePassword = (req, res) => {
    // 실제로는 기존 비밀번호 확인, 새 비밀번호 암호화 후 DB에 저장하는 로직이 들어갑니다.
    res.status(200).json({ message: "비밀번호가 성공적으로 변경되었습니다." });
};
exports.changePassword = changePassword;
// 로그아웃을 처리하는 컨트롤러 함수
const logoutUser = (req, res) => {
    // 실제로는 세션 또는 JWT 토큰을 무효화하는 로직이 들어갑니다.
    res.status(200).json({ message: "로그아웃이 성공적으로 처리되었습니다." });
};
exports.logoutUser = logoutUser;
// 회원 탈퇴를 처리하는 컨트롤러 함수
const withdrawUser = (req, res) => {
    // 실제로는 사용자 계정을 비활성화하거나 삭제하는 로직이 들어갑니다.
    res.status(200).json({ message: "회원 탈퇴가 성공적으로 처리되었습니다." });
};
exports.withdrawUser = withdrawUser;
