import React from 'react';
import { Article } from './MyPageTypes';

interface BookmarkedNewsProps {
    data: Article[];
}

const BookmarkedNews: React.FC<BookmarkedNewsProps> = ({ data }) => {
    return (
        <div className="bookmarked-news-section">
            <h2>북마크한 뉴스</h2>
            {data.length === 0 ? (
                <p>북마크한 뉴스가 없습니다.</p>
            ) : (
                <ul>
                    {data.map((article) => (
                        <li key={article.id}>
                            <a href={article.link} target="_blank" rel="noopener noreferrer">
                                {article.title}
                            </a>
                            <p>{article.publisher}</p>
                            <button>북마크 해제</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default BookmarkedNews;