import { create } from 'zustand';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  /** Registration share code (camelCase — matches `/auth/me`). */
  referralCode?: string;
  /** Same as `referralCode` (snake_case — matches `/referral/me` profile). */
  referral_code?: string;
  /** Optional alias from `/auth/me`. */
  code?: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (payload: { accessToken: string; refreshToken: string; user: User }) => void;
  setUser: (user: User | null) => void;
  clearSession: () => void;
  hydrate: () => void;
};

/**
 * Tokens in `localStorage` are convenient for SPAs but visible to XSS. Prefer **httpOnly** session cookies
 * issued by your API (same-site, secure) when you harden auth — then remove the keys below and read session from cookies.
 */
const ACCESS_KEY = 'vivan_access_token';
const REFRESH_KEY = 'vivan_refresh_token';
const USER_KEY = 'vivan_user';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ accessToken, refreshToken, user });
  },
  setUser: (user) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
  hydrate: () => {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const raw = localStorage.getItem(USER_KEY);
    let user: User | null = null;
    if (raw) {
      try {
        user = JSON.parse(raw) as User;
      } catch {
        user = null;
      }
    }
    set({ accessToken, refreshToken, user });
  }
}));
