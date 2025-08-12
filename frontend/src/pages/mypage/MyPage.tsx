
import React, { useState, useEffect } from 'react';
import './MyPage.css';

// 같은 폴더에 있는 타입 정의와 기능별 컴포넌트들을 불러옵니다.
import { ProfileData, Article, RatingHistoryItem } from './MyPageTypes';
import ProfileInfo from './ProfileInfo';
import BookmarkedNews from './BookmarkedNews';
import RatingHistory from './RatingHistory';
import LikedArticles from './LikedArticles';
import AccountManagement from './AccountManagement';
// 나중에 기타 추가사항 있을 경우 import Others from './Others';

// api.ts 파일에서 API 함수들을 가져옵니다.
import { 
    fetchProfileInfo, 
    fetchBookmarkedNews, 
    fetchRatingHistory, 
    fetchLikedArticles 
} from './api';

const MyPage: React.FC = () => {
    // 현재 활성화된 섹션을 관리하는 상태 (기본값: 프로필)
    const [activeSection, setActiveSection] = useState<string>('profile');
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [bookmarkedNews, setBookmarkedNews] = useState<Article[]>([]);
    const [ratingHistory, setRatingHistory] = useState<RatingHistoryItem[]>([]);
    const [likedArticles, setLikedArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // api.ts 파일의 함수들을 호출합니다.
                const profile = await fetchProfileInfo();
                const bookmarks = await fetchBookmarkedNews();
                const ratings = await fetchRatingHistory();
                const likes = await fetchLikedArticles();

                setProfileData(profile);
                setBookmarkedNews(bookmarks);
                setRatingHistory(ratings);
                setLikedArticles(likes);
            } catch (error) {
                console.error("데이터를 가져오는 중 오류 발생:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

        // 현재 활성화된 섹션에 따라 다른 컴포넌트를 렌더링합니다.
    const renderContent = (): React.ReactNode => {
    switch (activeSection) {
            case 'profile':
                return <ProfileInfo data={profileData} />;
            case 'bookmarks':
                return <BookmarkedNews data={bookmarkedNews} />;
            case 'ratings':
                return <RatingHistory data={ratingHistory} />;
            case 'likes':
                return <LikedArticles data={likedArticles} />;
            case 'account':
                return <AccountManagement />;
            // 나중에 기타 섹션이 추가되면 여기에 추가합니다.
            default:
                return null;
        }
    };

    if (loading) {
        return <div className="mypage-loading">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="mypage-container">
            <aside className="mypage-sidebar">
                <nav>
                    <ul className="mypage-menu">
                        <li className={activeSection === 'profile' ? 'active' : ''} onClick={() => setActiveSection('profile')}>프로필 정보</li>
                        <li className={activeSection === 'bookmarks' ? 'active' : ''} onClick={() => setActiveSection('bookmarks')}>북마크한 뉴스</li>
                        <li className={activeSection === 'ratings' ? 'active' : ''} onClick={() => setActiveSection('ratings')}>별점 평가 내역</li>
                        <li className={activeSection === 'likes' ? 'active' : ''} onClick={() => setActiveSection('likes')}>좋아요 기사</li>
                        <li className={activeSection === 'account' ? 'active' : ''} onClick={() => setActiveSection('account')}>계정 관리</li>
                        <li className={activeSection === 'others' ? 'active' : ''} onClick={() => setActiveSection('others')}>기타</li>
                    </ul>
                </nav>
            </aside>
            <main className="mypage-content">
                {renderContent()}
            </main>
        </div>
    );
};

export default MyPage;