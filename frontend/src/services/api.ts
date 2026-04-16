import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const baseURL = import.meta.env.VITE_API_URL as string;

export const api = axios.create({ baseURL });

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  const refreshToken = useAuthStore.getState().refreshToken || localStorage.getItem('vivan_refresh_token');
  if (!refreshToken) return null;
  const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  if (!data?.accessToken) return null;
  const user = data.user ?? JSON.parse(localStorage.getItem('vivan_user') || 'null');
  useAuthStore.getState().setSession({
    accessToken: data.accessToken,
    refreshToken,
    user
  });
  return data.accessToken as string;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken || localStorage.getItem('vivan_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const h = config.headers as Record<string, string | undefined>;
  if (config.data instanceof FormData) {
    delete h['Content-Type'];
  } else if (h['Content-Type'] === undefined) {
    h['Content-Type'] = 'application/json';
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const status = error.response?.status;
    const url = String(original?.url || '');

    if (status === 401 && !original?._retry && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        refreshPromise = null;
      }
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);
