"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { hasTenantPermission, type TenantRole, type TenantPermission } from "@/lib/permissions";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isAdmin: boolean;
  mcpAllowed?: boolean;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  businessLocale?: string | null;
  businessCountry?: string | null;
  businessCurrency?: string | null;
  businessTimezone?: string | null;
  businessTier: string | null;
  businessEffectiveTier: string | null;
  businessTrialEndsAt: string | null;
  businessSubscriptionEndsAt: string | null;
  businessSubscriptionStatus: string | null;
  businessHasRecurring?: boolean;
  businessAwaitingRecurringCharge?: boolean;
  businessFeatureOverrides: Record<string, boolean> | null;
  businessRole: string | null;
  businessPermissionOverrides?: Record<string, boolean> | null;
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
  const queryClient = useQueryClient();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data?.user || null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // A member the owner deactivated or removed is logged out server-side
  // (team-offboarding.ts). Re-check every 30s and whenever the tab regains focus, so
  // an open tab leaves at once: no session → /login; business taken away while
  // other businesses remain → reload into the business they still have.
  const signedInUserId = user?.id ?? null;
  const signedInBusinessId = user?.businessId ?? null;
  useEffect(() => {
    if (!signedInUserId) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.status >= 500) return; // server hiccup — never log out on that
        const data = res.ok ? await res.json() : null;
        const me = data?.user ?? null;
        if (!me || me.id !== signedInUserId) {
          stopped = true;
          queryClient.clear();
          window.location.href = "/login?reason=access_ended";
        } else if ((me.businessId ?? null) !== signedInBusinessId) {
          stopped = true;
          window.location.href = "/dashboard";
        }
      } catch {
        /* offline — try again next tick */
      }
    };
    const timer = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [signedInUserId, signedInBusinessId, queryClient]);

  const isOwner = user?.businessRole === "owner";
  const isManager = user?.businessRole === "manager";
  const isStaff = user?.businessRole === "user";
  const isVolunteer = user?.businessRole === "volunteer";

  const hasPermission = useCallback(
    (permission: TenantPermission): boolean => {
      if (!user?.businessRole) return false;
      return hasTenantPermission(
        user.businessRole as TenantRole,
        permission,
        user.businessPermissionOverrides ?? null
      );
    },
    [user?.businessRole, user?.businessPermissionOverrides]
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
    queryClient.clear();
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router, queryClient]);

  const exitImpersonation = useCallback(async () => {
    const res = await fetch("/api/auth/exit-impersonation", { method: "POST" });
    if (!res.ok) {
      console.error("Failed to exit impersonation:", await res.text());
      return; // Do not redirect if exit failed
    }
    queryClient.clear();
    const data = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null));
    setUser(data?.user || null);
    // Send the admin back to the tenants list they impersonated from.
    router.push("/owner/tenants");
    router.refresh();
  }, [router, queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, exitImpersonation, refreshUser, hasPermission, isOwner: !!isOwner, isManager: !!isManager, isStaff: !!isStaff, isVolunteer: !!isVolunteer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
