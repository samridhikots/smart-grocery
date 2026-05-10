"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, User } from "@/services/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("sg_token");
    const stored = localStorage.getItem("sg_user");
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("sg_token");
        localStorage.removeItem("sg_user");
      }
    }
    setIsLoading(false);
  }, []);

  const saveSession = (token: string, newUser: User) => {
    localStorage.setItem("sg_token", token);
    localStorage.setItem("sg_user", JSON.stringify(newUser));
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
    localStorage.removeItem("sg_token");
    localStorage.removeItem("sg_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
