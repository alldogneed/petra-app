"use client";

// Shared edit/save logic for every settings tab backed by `Business` columns
// (PATCH /api/settings). Keeps a draft of touched fields only, sends ONLY the
// fields that differ from the server copy, registers unsaved edits with the
// settings shell, and exposes `canEdit` (server requires SETTINGS_CRITICAL).
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJSON } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegisterDirty } from "@/components/settings/SettingsDirtyContext";
import type { Business } from "@/components/settings/shared";

export const BUSINESS_SETTINGS_QUERY_KEY = ["settings"] as const;

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

export async function patchBusinessSettings(data: Partial<Business>): Promise<Business> {
  const r = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "שגיאה בשמירת ההגדרות");
  return d as Business;
}

interface Options {
  /** Unique key for the unsaved-changes registry (e.g. "business"). */
  dirtyKey: string;
  successMessage?: string;
  /** Values shown when the server column is null (not sent unless edited). */
  defaults?: Partial<Business>;
}

export function useBusinessSettings({ dirtyKey, successMessage = "ההגדרות נשמרו", defaults }: Options) {
  const queryClient = useQueryClient();
  const { canCriticalSettings } = usePermissions();
  const { data: biz, isLoading, isError } = useQuery<Business>({
    queryKey: BUSINESS_SETTINGS_QUERY_KEY,
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [draft, setDraft] = useState<Partial<Business>>({});

  const values = useMemo(() => {
    if (!biz) return null;
    const merged: Business = { ...biz };
    for (const [k, v] of Object.entries(defaults ?? {})) {
      const key = k as keyof Business;
      if (merged[key] === null || merged[key] === undefined) (merged as unknown as Record<string, unknown>)[key] = v;
    }
    return { ...merged, ...draft } as Business;
  }, [biz, draft, defaults]);

  const changes = useMemo(() => {
    const out: Partial<Business> = {};
    if (!biz) return out;
    for (const [k, v] of Object.entries(draft)) {
      const key = k as keyof Business;
      const base = biz[key] ?? defaults?.[key];
      if (!sameValue(v, base)) (out as Record<string, unknown>)[key] = v;
    }
    return out;
  }, [biz, draft, defaults]);

  const dirty = Object.keys(changes).length > 0;
  useRegisterDirty(dirtyKey, dirty);

  const set = useCallback(<K extends keyof Business>(field: K, value: Business[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  const reset = useCallback(() => setDraft({}), []);

  const mutation = useMutation({
    mutationFn: (data: Partial<Business>) => patchBusinessSettings(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
      setDraft({});
      toast.success(successMessage);
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשמירת ההגדרות. נסה שוב."),
  });

  const save = useCallback(() => {
    if (!dirty || !canCriticalSettings) return;
    mutation.mutate(changes);
  }, [dirty, canCriticalSettings, changes, mutation]);

  return {
    biz,
    values,
    isLoading,
    isError,
    set,
    reset,
    save,
    dirty,
    changes,
    isSaving: mutation.isPending,
    canEdit: canCriticalSettings,
  };
}
