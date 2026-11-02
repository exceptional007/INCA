import React, { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "../types";
import api, {
  clearSession,
  storeSession,
  startSession,
  refreshSession,
} from "../api/axios";
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
function savedUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem("inca_user") || "null");
  } catch {
    return null;
  }
}
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(savedUser),
    [token, setToken] = useState<string | null>(() =>
      localStorage.getItem("inca_token"),
    ),
    [isLoading, setLoading] = useState(true);
  const cache = useQueryClient();
  useEffect(() => {
    const sync = () => {
      setUser(savedUser());
      setToken(localStorage.getItem("inca_token"));
      if (!localStorage.getItem("inca_token")) cache.clear();
    };
    window.addEventListener("inca-auth-updated", sync);
    window.addEventListener("storage", sync);
    let alive = true;
    const startupToken = localStorage.getItem("inca_token");
    (async () => {
      try {
        if (!localStorage.getItem("inca_token")) await refreshSession();
        const requestToken = localStorage.getItem("inca_token");
        const response = await api.get("/auth/me", { timeout: 20_000 });
        if (!alive || localStorage.getItem("inca_token") !== requestToken)
          return;
        const current = response.data.data;
        const existing = savedUser();
        storeSession(localStorage.getItem("inca_token")!, {
          ...existing,
          ...current,
          role: { ...existing?.role, code: current.role },
        });
      } catch (error: any) {
        if (alive && [401, 403].includes(error.response?.status) && localStorage.getItem("inca_token") === startupToken)
          clearSession();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      window.removeEventListener("inca-auth-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [cache]);
  const login = (t: string, u: User) => {
    cache.clear();
    startSession(t, u);
    setLoading(false);
  };
  const logout = () => {
    void api.post("/auth/logout").catch(() => {});
    clearSession();
    cache.clear();
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
};
