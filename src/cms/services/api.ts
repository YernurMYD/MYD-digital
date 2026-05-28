import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenPair } from '../types/auth';

const TOKEN_KEY = 'myd_access_token';
const REFRESH_KEY = 'myd_refresh_token';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set(tokens: TokenPair) {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<TokenPair> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) {
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post<TokenPair>('/api/v1/auth/refresh', { refreshToken })
          .then((r) => r.data);
      }

      const tokens = await refreshPromise;
      tokenStorage.set(tokens);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }

      return api(originalRequest);
    } catch {
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      refreshPromise = null;
    }
  },
);

export default api;
