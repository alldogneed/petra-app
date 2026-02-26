"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasTenantPermission, type TenantRole, type TenantPermission } from "@/lib/permissions";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  platformRole: string | null;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  businessRole: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasPermission: (permission: TenantPermission) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  hasPermission: () => false,
  isOwner: false,
  isManager: false,
  isStaff: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data?.user || null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const isOwner = user?.businessRole === "owner";
  const isManager = user?.businessRole === "manager";
  const isStaff = user?.businessRole === "user";

  const hasPermission = useCallback(
    (permission: TenantPermission): boolean => {
      if (!user?.businessRole) return false;
      return hasTenantPermission(user.businessRole as TenantRole, permission);
    },
    [user?.businessRole]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, hasPermission, isOwner: !!isOwner, isManager: !!isManager, isStaff: !!isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
