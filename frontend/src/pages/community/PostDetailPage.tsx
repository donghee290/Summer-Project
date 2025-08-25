import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import instance from "../../api/axiosInstance";
import dayjs from "../../utils/dayjsConfig"; // ✅ 공통 dayjs 사용

const CURRENT_USER_NO = 1; // 임시 로그인 유저

interface Comment {
  id: number;
  user: string;
  user_no: number;
  content: string;
  created_at: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  image: string | null;
  author: string;
  likes: number;
  liked: boolean;
  comments: number;
  created_at: string;
  commentList?: Comment[];
}

export const PostDetailPage = () => {
  const { postId } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPost = async () => {
    try {
      const res = await instance.get(`/posts/${postId}`);
      setPost(res.data);
    } catch (err) {
      console.error("게시글 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await instance.post(`/posts/${postId}/comments`, {
        content: newComment,
      });
      setPost((prev) =>
        prev
          ? { ...prev, commentList: [res.data, ...(prev.commentList || [])] }
          : prev
      );
      setNewComment("");
    } catch (err) {
      console.error("댓글 작성 실패:", err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await instance.delete(`/posts/${postId}/comments/${commentId}`);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              commentList: prev.commentList?.filter((c) => c.id !== commentId) || [],
            }
          : prev
      );
    } catch (err) {
      console.error("댓글 삭제 실패:", err);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [postId]);

  if (loading) return <div className="p-6">⏳ 로딩 중...</div>;
  if (!post) return <div className="p-6">❌ 게시글을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
      <p className="mb-4">{post.content}</p>
      {post.image && (
        <img
          src={post.image}
          alt="게시글 이미지"
          className="rounded-md mb-4 max-h-80 object-cover"
        />
      )}
      <p className="text-sm text-gray-500">
        작성자: {post.author} · {dayjs(post.created_at).tz().fromNow()}
      </p>
      <hr className="my-6" />

      {/* 댓글 영역 */}
      <h3 className="text-lg font-semibold mb-3">💬 댓글</h3>
      <textarea
        className="w-full border rounded-md p-2 h-24 resize-none mb-2"
        placeholder="댓글을 입력하세요"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
      />
      <div className="text-right mb-4">
        <button
          onClick={handleSubmitComment}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          작성
        </button>
      </div>

      <div className="space-y-4">
        {post.commentList && post.commentList.length > 0 ? (
          post.commentList.map((cmt) => (
            <div key={cmt.id} className="border-t py-3">
              <p className="mb-1 flex justify-between items-center">
                <span>
                  <strong>{cmt.user}</strong>{" "}
                  <span className="text-gray-400 text-xs ml-2">
                    {dayjs(cmt.created_at).tz().fromNow()}
                  </span>
                </span>
                {cmt.user_no === CURRENT_USER_NO && (
                  <button
                    onClick={() => handleDeleteComment(cmt.id)}
                    className="text-red-500 text-xs hover:underline"
                  >
                    삭제
                  </button>
                )}
              </p>
              <p>{cmt.content}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500">아직 댓글이 없습니다.</p>
        )}
      </div>
    </div>
  );
};
