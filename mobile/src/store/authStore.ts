import { create } from 'zustand';

type User = { id: number; name: string; email: string; role?: string } | null;

type AuthState = {
  user: User;
  accessToken: string | null;
  setSession: (payload: { user: NonNullable<User>; accessToken: string }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ user, accessToken }),
  clearSession: () => set({ user: null, accessToken: null })
}));
