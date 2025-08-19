import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart, FaRegComment } from "react-icons/fa";
import instance from "../../api/axiosInstance";
import { PostComposer, PostDraft } from "../../pages/community/PostComposer";
import axios from "axios";

export async function deletePost(postId: number) {
  await axios.delete(`http://localhost:8080/api/posts/${postId}`, {
    withCredentials: true,
  });
}

interface Post {
  id: number;
  title: string;
  content: string;
  repository: {
    id: number;
    name: string;
  };
  image: string | null;
  author: string;
  likes: number;
  comments: number;
  liked: boolean;
  createdAt?: string; // 작성 시간 표시용
}

export const CommunityHomePage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showComposer, setShowComposer] = useState(false);

  const fetchAllPosts = async () => {
    try {
      const res = await instance.get("/posts");
      setPosts(res.data);
    } catch (error) {
      console.error("게시글 불러오기 실패:", error);
    }
  };

  const createPost = async (draft: PostDraft) => {
    try {
      await instance.post("/posts", draft);
      setShowComposer(false);
      fetchAllPosts();
    } catch (error) {
      console.error("게시글 작성 실패:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("삭제 실패", err);
      alert("삭제 실패");
    }
  };

  const handleLikeToggle = (postId: number) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              liked: !post.liked,
              likes: post.liked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  };

  useEffect(() => {
    fetchAllPosts();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 상단 제목 + 버튼 */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">커뮤니티</h2>
        <button
          onClick={() => setShowComposer((prev) => !prev)}
          className="bg-blue-900 text-white px-4 py-2 rounded-md hover:bg-blue-800"
        >
          {showComposer ? "작성 취소" : "내 생각 공유하러 가기"}
        </button>
      </div>

      {showComposer && <PostComposer onSubmit={createPost} />}

      {/* 게시글 목록 */}
      <div className="space-y-6">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex justify-between items-start border-b border-gray-200 pb-6"
          >
            {/* 왼쪽 영역 */}
            <div className="flex flex-1">
              {/* 프로필 아이콘 */}
              <div className="w-12 h-12 rounded-full bg-gray-300 mr-4"></div>

              {/* 본문 */}
              <div className="flex-1">
                {/* 제목 */}
                <h4
                  onClick={() => navigate(`/community/post/${post.id}`)}
                  className="text-[15px] font-semibold mb-2 cursor-pointer hover:underline"
                >
                  {post.title}
                </h4>

                {/* 내용 */}
                <p
                  onClick={() => navigate(`/community/post/${post.id}`)}
                  className="text-sm text-gray-600 mb-3 leading-relaxed cursor-pointer"
                >
                  {post.content.length > 80
                    ? post.content.slice(0, 80) + "..."
                    : post.content}
                </p>

                {/* 하단 정보 */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="cursor-pointer hover:underline">
                    게시글 제목. {post.repository?.name || ""}
                  </span>
                  <span>{post.createdAt || "9시간 전"}</span>

                  <span
                    onClick={() => handleLikeToggle(post.id)}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    {post.liked ? (
                      <FaHeart className="text-red-500" />
                    ) : (
                      <FaRegHeart />
                    )}
                    {post.likes}
                  </span>

                  <span className="flex items-center gap-1">
                    <FaRegComment />
                    {post.comments}
                  </span>

                  <span>{post.author}</span>

                  <button
                    onClick={() => handleDelete(post.id)}
                    className="text-red-500 hover:underline text-xs"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>

            {/* 오른쪽 썸네일 */}
            {post.image && (
              <img
                src={post.image}
                alt="게시글 이미지"
                className="w-32 h-20 ml-5 rounded-xl object-cover"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
