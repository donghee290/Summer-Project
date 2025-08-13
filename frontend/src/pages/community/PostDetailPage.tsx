import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { dummyPosts } from "../../data/dummyData";

// 댓글 타입 정의
interface Comment {
  id: number;
  user: string;
  content: string;
  createdAt: string;
}

// 게시물 타입 정의 (dummyPosts 기준)
interface Post {
  id: number;
  title: string;
  content: string;
  repository: {
    id: number;
    name: string;
  };
  image: string;
  author: string;
  likes: number;
  comments: number;
  liked: boolean;
}

// 현재 로그인된 유저 이름 (더미)
const CURRENT_USER = "이강산";

export const PostDetailPage = () => {
  const { postId } = useParams();
  const post = dummyPosts.find((p) => p.id === Number(postId));

  const [commentList, setCommentList] = useState<Comment[]>([
    {
      id: 1,
      user: "홍길동",
      content: "정말 유익한 글이네요!",
      createdAt: "2025-08-07",
    },
    {
      id: 2,
      user: "임꺽정",
      content: "저도 궁금했는데 덕분에 알게 되었어요!",
      createdAt: "2025-08-07",
    },
  ]);

  const [newComment, setNewComment] = useState("");

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;

    const nextComment: Comment = {
      id: commentList.length + 1,
      user: CURRENT_USER,
      content: newComment,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setCommentList([...commentList, nextComment]);
    setNewComment("");
  };

  if (!post) {
    return <div style={{ padding: 20 }}>❌ 게시글을 찾을 수 없습니다.</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <div style={{ fontSize: 14, color: "gray" }}>{post.repository.name}</div>
      <h2>{post.title}</h2>
      <p>{post.content}</p>
      <p style={{ fontSize: 14, color: "gray" }}>작성자: {post.author}</p>
      <hr style={{ margin: "24px 0" }} />

      {/* 댓글 영역 */}
      <div>
        <h3>💬 댓글</h3>

        {/* 댓글 입력창 */}
        <textarea
          style={{
            width: "100%",
            height: 80,
            resize: "none",
            padding: 10,
            marginTop: 10,
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
          placeholder="댓글을 입력하세요"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />

        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button
            onClick={handleSubmitComment}
            style={{
              padding: "8px 16px",
              backgroundColor: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            작성
          </button>
        </div>

        {/* 댓글 목록 */}
        <div style={{ marginTop: 24 }}>
          {commentList.length === 0 ? (
            <p>아직 댓글이 없습니다.</p>
          ) : (
            commentList.map((cmt) => (
              <div key={cmt.id} style={{ borderTop: "1px solid #eee", padding: "12px 0" }}>
                <p style={{ marginBottom: 4 }}>
                  <strong>{cmt.user}</strong> <span style={{ color: "#999", fontSize: 12 }}>{cmt.createdAt}</span>
                </p>
                <p style={{ margin: 0 }}>{cmt.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
