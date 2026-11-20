import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const DEFAULT_NATIVE_API_URL = 'https://school-erp-x967.onrender.com/api';

const resolveApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_NATIVE_API_URL || DEFAULT_NATIVE_API_URL;
  }
  if (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.vercel.app') &&
    import.meta.env.VITE_API_URL
  ) {
    return import.meta.env.VITE_API_URL;
  }
  // Route AI Studio / local Express browser requests through same-origin /api proxy
  // so CORS restrictions on external backend origins never block requests.
  return '/api';
};

const API_BASE_URL = resolveApiBaseUrl();

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;