import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart, FaRegComment } from "react-icons/fa";
import instance from "../../api/axiosInstance"; // axios 기본 설정
import { PostComposer ,PostDraft } from "../../pages/community/PostComposer"; // 게시글 작성 컴포넌트
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
}

export const CommunityHomePage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showComposer, setShowComposer] = useState(false);



  // 📌 모든 게시글 가져오기
  const fetchAllPosts = async () => {
    try {
      const res = await instance.get("/posts");
      setPosts(res.data);
    } catch (error) {
      console.error("게시글 불러오기 실패:", error);
    }
  };

  // 📌 게시글 작성
  const createPost = async (draft: PostDraft) => {
    try {
      await instance.post("/posts", draft);
      setShowComposer(false);
      fetchAllPosts(); // 작성 후 목록 새로고침
    } catch (error) {
      console.error("게시글 작성 실패:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
  
    try {
      await deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error("삭제 실패", err);
      alert("삭제 실패");
    }
  };

  // 📌 좋아요 토글
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

  // 📌 저장소 클릭 시
  const handleRepositoryClick = (repositoryId: number) => {
    navigate(`/community/repository/${repositoryId}`);
  };

  // 📌 컴포넌트 로드시 데이터 로드
  useEffect(() => {
    fetchAllPosts();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      {/* 게시글 작성 버튼 */}
      <button onClick={() => setShowComposer((prev) => !prev)}>
        {showComposer ? "작성 취소" : "게시글 작성하기"}
      </button>
      

      {/* 게시글 작성창 */}
      {showComposer && <PostComposer onSubmit={createPost} />}

     

      {/* 게시글 목록 */}
      {posts.map((post) => (
  <div
    key={post.id}
    style={{
      display: "flex",
      borderBottom: "1px solid #ccc",
      padding: "16px 0",
      alignItems: "flex-start",
      justifyContent: "space-between",
    }}
  >
    <div style={{ flex: 1 }}>
      <p
        style={{ fontSize: "13px", color: "#777", cursor: "pointer" }}
        onClick={() => handleRepositoryClick(post.repository.id)}
      >
        {post.repository.name}
      </p>
      <div
        style={{ cursor: "pointer" }}
        onClick={() => navigate(`/community/post/${post.id}`)}
      >
        <h3 style={{ margin: "6px 0" }}>{post.title}</h3>
        <p style={{ color: "#555" }}>{post.content}</p>
        <div style={{ display: "flex", alignItems: "center", marginTop: "8px", gap: "12px" }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleLikeToggle(post.id);
            }}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            {post.liked ? <FaHeart color="red" /> : <FaRegHeart />} &nbsp;{post.likes}
          </span>
          <span style={{ display: "flex", alignItems: "center" }}>
            <FaRegComment /> &nbsp;{post.comments}
          </span>

          {/* 작성자 + 삭제 버튼 */}
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {post.author}
            <button
              style={{
                background: "transparent",
                border: "none",
                color: "red",
                cursor: "pointer",
                fontSize: "12px"
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(post.id);
              }}
            >
              삭제
            </button>
          </span>
        </div>
      </div>
    </div>

    {post.image && (
      <img
        src={post.image}
        alt="게시글 이미지"
        style={{
          width: "80px",
          height: "80px",
          marginLeft: "20px",
          borderRadius: "10px",
          objectFit: "cover",
        }}
      />
    )}
  </div>
))}

    </div>
  );
};
