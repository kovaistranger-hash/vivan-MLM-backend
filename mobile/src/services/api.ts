import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/** Set to your API origin including `/api` if that is how the web app calls the backend. */
const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
