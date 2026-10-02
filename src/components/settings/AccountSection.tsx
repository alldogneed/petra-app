"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, AlertCircle, Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { useRegisterDirty } from "./SettingsDirtyContext";

export function ChangePasswordSection() {
  const { user } = useAuth();
  const isGoogleOnly = user?.authProvider === "google" && !user?.hasPassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useRegisterDirty("password", !!(currentPassword || newPassword || confirmPassword));

  const changeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      return data;
    },
    onSuccess: () => {
      toast.success("הסיסמה שונתה בהצלחה");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const setMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      return data;
    },
    onSuccess: () => {
      toast.success("הסיסמה הוגדרה בהצלחה — כעת ניתן להתחבר גם עם אימייל וסיסמה");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const mutation = isGoogleOnly ? setMutation : changeMutation;

  function handleSubmit() {
    setError(null);
    if (!isGoogleOnly && !currentPassword) {
      setError("יש למלא את כל השדות");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("יש למלא את כל השדות");
      return;
    }
    if (newPassword.length < 12) {
      setError("הסיסמה החדשה חייבת להכיל לפחות 12 תווים");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-petra-text">
          {isGoogleOnly ? "הגדרת סיסמה" : "שינוי סיסמה"}
        </h3>
      </div>

      {isGoogleOnly && (
        <div className="flex items-start gap-2 p-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-800 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-500" />
          <p>
            חשבונך מחובר דרך Google. באפשרותך להגדיר סיסמה כדי להתחבר גם עם אימייל וסיסמה בנוסף לכניסה עם Google.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {!isGoogleOnly && (
          <div>
            <label className="label">סיסמה נוכחית</label>
            <div className="relative">
              <input
                className="input w-full pl-10"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                dir="ltr"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        <div>
          <label className="label">{isGoogleOnly ? "סיסמה חדשה" : "סיסמה חדשה"}</label>
          <div className="relative">
            <input
              className="input w-full pl-10"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              dir="ltr"
              placeholder="לפחות 8 תווים"
            />
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">אימות סיסמה</label>
          <input
            className="input w-full"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
            placeholder="הזן שוב את הסיסמה"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          {mutation.isPending
            ? isGoogleOnly ? "מגדיר..." : "מחליף..."
            : isGoogleOnly ? "הגדר סיסמה" : "החלף סיסמה"}
        </button>
      </div>
    </div>
  );
}
