import React, { useState } from "react";

export interface PostDraft {
  title: string;
  content: string;
  repositoryId: number;
  image?: string | null;
}

interface PostComposerProps {
  onSubmit: (draft: PostDraft) => void | Promise<void>;
}

export const PostComposer: React.FC<PostComposerProps> = ({ onSubmit }) => {
  const [repositoryId, setRepositoryId] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string>("");

  const isValid =
    repositoryId > 0 && title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await onSubmit({
      repositoryId,
      title: title.trim(),
      content: content.trim(),
      image: image.trim() ? image.trim() : null,
    });

    // 초기화
    setTitle("");
    setContent("");
    setImage("");
    setRepositoryId(0);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}
    >
      <h3 style={{ marginBottom: 12 }}>✍️ 새 게시글 작성</h3>

      <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
        저장소 ID
      </label>
      <input
        type="number"
        value={repositoryId}
        onChange={(e) => setRepositoryId(Number(e.target.value))}
        placeholder="예) 101"
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
        제목
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
        내용
      </label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="내용을 입력하세요"
        style={{ width: "100%", padding: 8, marginBottom: 12, resize: "vertical" }}
      />

      <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
        이미지 URL (선택)
      </label>
      <input
        value={image}
        onChange={(e) => setImage(e.target.value)}
        placeholder="https://example.com/image.png"
        style={{ width: "100%", padding: 8, marginBottom: 16 }}
      />

      <div style={{ textAlign: "right" }}>
        <button
          type="submit"
          disabled={!isValid}
          style={{
            padding: "8px 16px",
            backgroundColor: isValid ? "#2563eb" : "#9ca3af",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          게시글 등록
        </button>
      </div>
    </form>
  );
};

export default PostComposer;
