import { createContext, useContext } from "react";

const AUTH_KEY = "bl-auth";

export type AuthUser = {
  id: string;
  fullName: string;
  nickname: string | null;
  photo_url?: string | null;
};

export function getStoredAuth(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(user: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export type AuthContextType = {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
