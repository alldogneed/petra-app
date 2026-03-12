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
  isAdmin: boolean;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  businessTier: string | null;
  businessEffectiveTier: string | null;
  businessTrialEndsAt: string | null;
  businessSubscriptionEndsAt: string | null;
  businessFeatureOverrides: Record<string, boolean> | null;
  businessRole: string | null;
  authProvider: string;
  hasPassword: boolean;
  isImpersonating: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  exitImpersonation: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: TenantPermission) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isVolunteer: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  exitImpersonation: async () => {},
  refreshUser: async () => {},
  hasPermission: () => false,
  isOwner: false,
  isManager: false,
  isStaff: false,
  isVolunteer: false,
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
  const isVolunteer = user?.businessRole === "volunteer";

  const hasPermission = useCallback(
    (permission: TenantPermission): boolean => {
      if (!user?.businessRole) return false;
      return hasTenantPermission(user.businessRole as TenantRole, permission);
    },
    [user?.businessRole]
  );

  const refreshUser = useCallback(async () => {
    const data = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null));
    setUser(data?.user || null);
  }, []);

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

  const exitImpersonation = useCallback(async () => {
    const res = await fetch("/api/auth/exit-impersonation", { method: "POST" });
    if (!res.ok) {
      console.error("Failed to exit impersonation:", await res.text());
      return; // Do not redirect if exit failed
    }
    const data = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null));
    setUser(data?.user || null);
    router.push("/owner/tenants");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, exitImpersonation, refreshUser, hasPermission, isOwner: !!isOwner, isManager: !!isManager, isStaff: !!isStaff, isVolunteer: !!isVolunteer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
