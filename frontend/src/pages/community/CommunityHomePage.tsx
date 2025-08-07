// src/pages/community/CommunityHomePage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface DummyPost {
  id: number;
  content: string;
  repository: {
    id: number;
    name: string;
  };
}

const dummyPosts: DummyPost[] = [
  {
    id: 1,
    content: '프론트엔드 컴포넌트 분리하는 방법 정리해봤어요!',
    repository: { id: 101, name: 'frontend-tips' },
  },
  {
    id: 2,
    content: '백엔드 라우터 설계는 이렇게 하면 효율적이에요.',
    repository: { id: 102, name: 'backend-guide' },
  },
];

// 로그인 상태라고 가정
const isLoggedIn = true;

export const CommunityHomePage = () => {
  const navigate = useNavigate();

  const [likes, setLikes] = useState<{ [postId: number]: boolean }>({});
  const [comments, setComments] = useState<{ [postId: number]: string[] }>({});
  const [inputValues, setInputValues] = useState<{ [postId: number]: string }>({});

  const handleToggleLike = (postId: number) => {
    setLikes((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleAddComment = (postId: number) => {
    const newComment = inputValues[postId]?.trim();
    if (!newComment) return;
    setComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment],
    }));
    setInputValues((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleChangeInput = (postId: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [postId]: value }));
  };

  const handleRepoClick = (repoId: number) => {
    navigate(`/community/repository/${repoId}`);
  };

  const handlePostClick = (postId: number) => {
    navigate(`/community/post/${postId}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧠 커뮤니티 게시판</h1>

      {dummyPosts.map((post) => (
        <div
          key={post.id}
          className="border rounded p-4 mb-6 shadow-sm"
        >
          <div className="text-sm text-gray-500 mb-1">
            저장소:{" "}
            <span
              onClick={() => handleRepoClick(post.repository.id)}
              className="text-blue-600 hover:underline cursor-pointer"
            >
              {post.repository.name}
            </span>
          </div>

          <p
            onClick={() => handlePostClick(post.id)}
            className="mb-2 cursor-pointer hover:underline"
          >
            {post.content}
          </p>

          {isLoggedIn ? (
            <div>
              {/* 좋아요 버튼 */}
              <button
                onClick={() => handleToggleLike(post.id)}
                className={`mr-4 text-sm ${
                  likes[post.id] ? 'text-red-500 font-bold' : 'text-gray-500'
                }`}
              >
                ❤️ 좋아요
              </button>

              {/* 댓글 입력 */}
              <div className="mt-4">
                <input
                  value={inputValues[post.id] || ''}
                  onChange={(e) => handleChangeInput(post.id, e.target.value)}
                  placeholder="댓글을 입력하세요"
                  className="border px-2 py-1 rounded w-full mb-2"
                />
                <button
                  onClick={() => handleAddComment(post.id)}
                  className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
                >
                  댓글 작성
                </button>
              </div>

              {/* 댓글 목록 */}
              {comments[post.id]?.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-gray-800">
                  {comments[post.id].map((comment, index) => (
                    <li key={index} className="border p-2 rounded bg-gray-50">
                      {comment}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-right text-sm text-gray-400 italic mt-4">
              로그인 후 좋아요/댓글을 달 수 있습니다.
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
