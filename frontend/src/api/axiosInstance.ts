import axios from 'axios';
import { useAuthStore } from '../store';
import { refreshAccessToken } from './user/userApi';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const instance = axios.create({
  baseURL,
  withCredentials: true,
});

// 요청마다 토큰 자동 삽입 (optional)
instance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default instance;

// 401 응답 시 리프레시 토큰으로 재발급 후 재시도
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { refreshToken } = useAuthStore.getState() as any;
        if (!refreshToken) {
          return Promise.reject(error);
        }
        const { token } = await refreshAccessToken(refreshToken);
        useAuthStore.getState().setToken(token);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return instance(originalRequest);
      } catch (e) {
        useAuthStore.getState().logout();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);
