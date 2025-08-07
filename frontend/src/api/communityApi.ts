// src/api/communityApi.ts
import axios from './axiosInstance';

// 게시글 데이터 타입
export interface Post {
  id: number;
  content: string;
  repository: {
    id: number;
    name: string;
  };
  created_at: string;
}

// ✅ 전체 게시글 불러오기 (커뮤니티 메인 홈용)
export const fetchAllPosts = async (): Promise<Post[]> => {
  const res = await axios.get('/posts');
  return res.data;
};

// ✅ 특정 저장소 게시글 불러오기
export const fetchPostsByRepository = async (repoId: number): Promise<Post[]> => {
  const res = await axios.get(`/repositories/${repoId}/posts`);
  return res.data;
};

// ✅ 게시글 작성
export const createPost = async (repoId: number, content: string): Promise<Post> => {
  const res = await axios.post(`/repositories/${repoId}/posts`, { content });
  return res.data;
};

// ✅ 게시글 상세 보기
export const fetchPostDetail = async (postId: number): Promise<Post> => {
  const res = await axios.get(`/posts/${postId}`);
  return res.data;
};
