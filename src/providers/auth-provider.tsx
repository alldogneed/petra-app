"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  platformRole: string | null;
  businessId: string | null;
  businessName: string | null;
  businessRole: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const DEMO_USER: AuthUser = {
  id: "demo-user-001",
  email: "moshe@petra.co.il",
  name: "משה כהן",
  avatarUrl: null,
  platformRole: null,
  businessId: "demo-business-001",
  businessName: "הכלבייה של משה",
  businessRole: "owner",
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<AuthUser | null>(DEMO_USER);
  const [loading] = useState(false);
  const router = useRouter();

  const logout = useCallback(async () => {
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
