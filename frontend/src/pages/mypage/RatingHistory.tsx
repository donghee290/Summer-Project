import React from 'react';
import { RatingHistoryItem } from './MyPageTypes';

interface RatingHistoryProps {
    data: RatingHistoryItem[];
}

const RatingHistory: React.FC<RatingHistoryProps> = ({ data }) => {
    return (
        <div className="rating-history-section">
            <h2>별점 평가 내역</h2>
            {data.length === 0 ? (
                <p>별점 평가 내역이 없습니다.</p>
            ) : (
                <ul>
                    {data.map((item) => (
                        <li key={item.id}>
                            <a href={item.link} target="_blank" rel="noopener noreferrer">
                                {item.title}
                            </a>
                            <p>별점: {item.rating}점</p>
                            <span>평가일: {item.date}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RatingHistory;