import axios from 'axios';
import { useAuthStore } from '../store';

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
