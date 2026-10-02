"use client";

// Tracks unsaved edits across the settings screen. A tab registers its dirty
// state with `useRegisterDirty(key, dirty)`; the shell asks `guard(action)` before
// switching tabs, and while anything is dirty we also warn on reload/close and on
// in-app link clicks (sidebar etc.) — otherwise edits vanish silently.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DirtyContextValue {
  isDirty: boolean;
  setDirty: (key: string, dirty: boolean) => void;
  /** Runs `action` now, or after the user confirms discarding unsaved edits. */
  guard: (action: () => void) => void;
}

const SettingsDirtyContext = createContext<DirtyContextValue | null>(null);

export function SettingsDirtyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<(() => void) | null>(null);
  const isDirty = dirtyKeys.size > 0;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key); else next.delete(key);
      return next;
    });
  }, []);

  const guard = useCallback((action: () => void) => {
    if (!isDirtyRef.current) { action(); return; }
    setPending(() => action);
  }, []);

  // Browser reload / close tab.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // In-app navigation through <a>/<Link> (sidebar, topbar…) — the App Router has
  // no route-change blocker, so intercept same-origin link clicks in capture phase.
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => router.push(url.pathname + url.search + url.hash));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, router]);

  const value = useMemo(() => ({ isDirty, setDirty, guard }), [isDirty, setDirty, guard]);

  return (
    <SettingsDirtyContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        title="יש שינויים שלא נשמרו"
        description="אם תמשיך, השינויים שעשית בעמוד הזה יאבדו."
        confirmLabel="המשך בלי לשמור"
        cancelLabel="הישאר בעמוד"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          setDirtyKeys(new Set());
          action?.();
        }}
      />
    </SettingsDirtyContext.Provider>
  );
}

/** Registers `dirty` under `key` for the lifetime of the calling component. */
export function useRegisterDirty(key: string, dirty: boolean) {
  const ctx = useContext(SettingsDirtyContext);
  const setDirty = ctx?.setDirty;
  useEffect(() => {
    setDirty?.(key, dirty);
  }, [setDirty, key, dirty]);
  useEffect(() => () => setDirty?.(key, false), [setDirty, key]);
}

export function useSettingsDirty(): DirtyContextValue {
  return useContext(SettingsDirtyContext) ?? { isDirty: false, setDirty: () => {}, guard: (a) => a() };
}
