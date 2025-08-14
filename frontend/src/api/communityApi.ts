// src/api/communityApi.ts
import axios from "./axiosInstance";

export const fetchAllPosts = async () => {
  const { data } = await axios.get("/posts");
  return data;
};

export const fetchPostDetail = async (postId: number) => {
  const { data } = await axios.get(`/posts/${postId}`);
  return data;
};

export const createPost = async (draft: {
  repositoryId: number; title: string; content: string; image?: string | null;
}) => {
  const { data } = await axios.post(`/posts`, draft);
  return data;
};

export const createComment = async (postId: number, content: string) => {
  const { data } = await axios.post(`/posts/${postId}/comments`, { content });
  return data;
};

export const toggleLike = async (postId: number) => {
  const { data } = await axios.post(`/posts/${postId}/like`);
  return data; // { liked, likes }
};
