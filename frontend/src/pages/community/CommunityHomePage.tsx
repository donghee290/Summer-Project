// src/pages/community/CommunityHomePage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart, FaRegComment } from "react-icons/fa";
import { dummyPosts } from "../../data/dummyData";
import { PostComposer } from "../../pages/community/PostComposer";
import type { PostDraft, RepositoryRef } from "../../pages/community/PostComposer";

interface Post {
  id: number;
  title: string;
  content: string;
  repository: { id: number; name: string };
  image: string;
  author: string;
  likes: number;
  comments: number;
  liked: boolean;
}

export const CommunityHomePage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>(dummyPosts);
  const [showComposer, setShowComposer] = useState(false);

  // 저장소 목록(중복 제거)
  const repositories: RepositoryRef[] = useMemo(() => {
    const map = new Map<number, string>();
    posts.forEach((p) => map.set(p.repository.id, p.repository.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [posts]);

  // ✅ draft 객체 그대로 받음
  const handleAddPost = (draft: PostDraft) => {
    const repo = repositories.find((r) => r.id === draft.repositoryId);
    if (!repo) return;

    const newPost: Post = {
      id: (posts[0]?.id ?? 0) + 1,
      title: draft.title,
      content: draft.content,
      repository: { id: repo.id, name: repo.name },
      image: draft.image || "https://via.placeholder.com/80x80?text=New",
      author: "현재유저",
      likes: 0,
      comments: 0,
      liked: false,
    };
    setPosts((prev) => [newPost, ...prev]);
    setShowComposer(false);
  };

  const handleLikeToggle = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    );
  };

  const handleRepositoryClick = (repositoryId: number) => {
    navigate(`/community/repository/${repositoryId}`);
  };

  return (
    <div style={{ padding: "20px" }}>
      <button onClick={() => setShowComposer(v => !v)} style={{ padding: "8px 16px", marginBottom: 16 }}>
        {showComposer ? "작성창 닫기" : "게시글 작성하기"}
      </button>

      {showComposer && (
        <PostComposer repositories={repositories} onSubmit={handleAddPost} />
      )}

      {posts.map((post) => (
        <div key={post.id} style={{ display: "flex", borderBottom: "1px solid #ccc", padding: "16px 0", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "13px", color: "#777", cursor: "pointer" }}
               onClick={() => handleRepositoryClick(post.repository.id)}>
              {post.repository.name}
            </p>
            <div style={{ cursor: "pointer" }} onClick={() => navigate(`/community/post/${post.id}`)}>
              <h3 style={{ margin: "6px 0" }}>{post.title}</h3>
              <p style={{ color: "#555" }}>{post.content}</p>
              <div style={{ display: "flex", alignItems: "center", marginTop: "8px" }}>
                <span onClick={(e) => { e.stopPropagation(); handleLikeToggle(post.id); }}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", marginRight: "16px" }}>
                  {post.liked ? <FaHeart color="red" /> : <FaRegHeart />} &nbsp;{post.likes}
                </span>
                <span style={{ display: "flex", alignItems: "center", marginRight: "16px" }}>
                  <FaRegComment /> &nbsp;{post.comments}
                </span>
                <span>{post.author}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
