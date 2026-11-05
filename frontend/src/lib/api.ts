import axios from 'axios';

// Cleanly resolve backend base URL and API base URL
const rawEnvUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
export const BACKEND_URL = rawEnvUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
export const API_BASE = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL;

export const api = axios.create({
  baseURL: API_BASE,
});

// Request interceptor to attach JWT auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Optional: handle token expiration
    }
    return Promise.reject(error);
  }
);

export function getMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  if (url.includes('cloudinary.com') || url.startsWith('https://res.cloudinary.com')) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${BACKEND_URL}${url}`;
  }
  if (
    url.includes('localhost:3000') ||
    url.includes('72.60.96.242') ||
    url.includes('backend:3000')
  ) {
    const parts = url.split('/uploads/');
    if (parts.length > 1) {
      return `${BACKEND_URL}/uploads/${parts[1]}`;
    }
  }
  return url;
}

export default api;
