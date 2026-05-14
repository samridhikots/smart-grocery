"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, User } from "@/services/api";
import { STORAGE_KEYS } from "@/lib/constants";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  completeOnboarding: (data: {
    household_size: number;
    monthly_budget: number;
    dietary_prefs: string;
  }) => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    if (!token) {
      setIsLoading(false);
      return;
    }
    // Validate token with the server; update user from latest server data
    authApi.me()
      .then((serverUser) => {
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(serverUser));
        setUser(serverUser);
      })
      .catch(() => {
        // Token expired or revoked — clear session
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.user);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveSession = (token: string, newUser: User) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser));
    setUser(newUser);
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    saveSession(data.access_token, data.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const data = await authApi.signup(name, email, password);
    saveSession(data.access_token, data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    setUser(null);
  }, []);

  const completeOnboarding = useCallback(
    async (data: { household_size: number; monthly_budget: number; dietary_prefs: string }) => {
      const updated = await authApi.onboarding(data);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
      setUser(updated);
    },
    []
  );

  const updateUser = useCallback((newUser: User) => {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, completeOnboarding, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
