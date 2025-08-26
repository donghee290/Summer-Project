import React, { useState } from "react";

export interface PostDraft {
  title: string;
  content: string;
  image_url?: string | null;
}

interface PostComposerProps {
  onSubmit: (draft: PostDraft) => void | Promise<void>;
}

export const PostComposer: React.FC<PostComposerProps> = ({ onSubmit }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await onSubmit({
      title: title.trim(),
      content: content.trim(),
      image_url: image.trim() ? image.trim() : null,
    });

    setTitle("");
    setContent("");
    setImage("");
  };

  return (
    <form onSubmit={handleSubmit} className="border p-4 rounded-md mb-6 bg-white shadow-sm">
      <h3 className="mb-4 font-semibold">✍️ 새 게시글 작성</h3>
      <label className="block text-sm text-gray-600 mb-1">제목</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full border rounded-md p-2 mb-3"
      />
      <label className="block text-sm text-gray-600 mb-1">내용</label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="내용을 입력하세요"
        className="w-full border rounded-md p-2 mb-3"
      />
      <label className="block text-sm text-gray-600 mb-1">이미지 URL (선택)</label>
      <input
        value={image}
        onChange={(e) => setImage(e.target.value)}
        placeholder="https://example.com/image.png"
        className="w-full border rounded-md p-2 mb-4"
      />
      <div className="text-right">
        <button
          type="submit"
          disabled={!isValid}
          className={`px-4 py-2 rounded-md text-white ${
            isValid ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          게시글 등록
        </button>
      </div>
    </form>
  );
};

export default PostComposer;
