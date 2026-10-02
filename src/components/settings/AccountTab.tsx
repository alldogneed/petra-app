"use client";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { ChangePasswordSection } from "./AccountSection";
import { SecurityTab } from "./SecurityTab";
import { useRegisterDirty } from "./SettingsDirtyContext";

const ROLE_LABELS: Record<string, string> = { owner: "בעלים", manager: "מנהל/ת", user: "עובד/ת", volunteer: "מתנדב/ת" };

/** "פרופיל ואבטחה" — personal settings of the signed-in member (not the business). */
export function AccountTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <ProfileCard />
      <ChangePasswordSection />
      <SecurityTab />
    </div>
  );
}

function ProfileCard() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  useEffect(() => { if (user?.name) setName(user.name); }, [user?.name]);

  const trimmed = name.trim();
  const dirty = !!user && trimmed !== "" && trimmed !== user.name;
  useRegisterDirty("profile-name", dirty);

  const mutation = useMutation({
    mutationFn: async (newName: string) => {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "שגיאה בעדכון השם");
      return d;
    },
    onSuccess: async () => {
      await refreshUser();
      toast.success("השם עודכן");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בעדכון השם"),
  });

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserRound className="w-4 h-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-petra-text">הפרופיל שלי</h3>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (dirty) mutation.mutate(trimmed); }}
      >
        <div>
          <label className="label" htmlFor="profile-name">השם שלך (מוצג בתוך המערכת וביומן הפעילות)</label>
          <div className="flex gap-2">
            <input
              id="profile-name"
              className="input flex-1 min-w-0"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם מלא"
            />
            <button type="submit" disabled={!dirty || mutation.isPending} className="btn-primary flex items-center gap-1.5 px-4 flex-shrink-0">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              עדכן
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-petra-muted text-xs mb-0.5">אימייל להתחברות</dt>
            <dd className="text-petra-text break-all" dir="ltr">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-petra-muted text-xs mb-0.5">התפקיד שלך בעסק</dt>
            <dd className="text-petra-text">{ROLE_LABELS[user?.businessRole ?? ""] ?? "—"}</dd>
          </div>
        </dl>
      </form>
    </div>
  );
}
