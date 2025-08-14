import React from 'react';
import { Article } from './MyPageTypes';

interface LikedArticlesProps {
    data: Article[];
}

const LikedArticles: React.FC<LikedArticlesProps> = ({ data }) => {
    return (
        <div className="liked-articles-section">
            <h2>좋아요 기사</h2>
            {data.length === 0 ? (
                <p>좋아요를 누른 기사가 없습니다.</p>
            ) : (
                <ul>
                    {data.map((article) => (
                        <li key={article.id}>
                            <a href={article.link} target="_blank" rel="noopener noreferrer">
                                {article.title}
                            </a>
                            <p>좋아요 수: {article.likesCount}</p>
                            <span>상태: {article.status === 'liked' ? '좋아요' : '좋아요 취소'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LikedArticles;