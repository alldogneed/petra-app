"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Target,
  UserPlus,
  ClipboardList,
  Link2,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ─── New Customer Drawer ──────────────────────────────────────────────────────

function NewCustomerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 300);
    } else {
      setName("");
      setPhone("");
    }
  }, [open]);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("לקוח נוצר בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    } catch {
      toast.error("שגיאה ביצירת הלקוח");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdrop}
        className={[
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer sheet */}
      <div
        className={[
          "fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none",
        ].join(" ")}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-petra-border">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-petra-muted hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
          <h2 className="text-base font-bold text-petra-text">לקוח חדש</h2>
          <div className="w-8" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pt-5 space-y-4" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}>
          <div>
            <label className="label">
              שם מלא <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              dir="rtl"
              className="input"
            />
          </div>
          <div>
            <label className="label">
              טלפון <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
              className="input"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
            className="btn-primary w-full justify-center h-12 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <UserPlus size={16} />
                צור לקוח
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Main Bottom Nav ──────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState<"intake" | "booking" | null>(null);

  const isHome = pathname === "/dashboard" || pathname === "/";

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function handleCopyBookingLink() {
    const slug = user?.businessSlug || user?.businessId || "demo-business-001";
    const url = `${window.location.origin}/book/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("booking");
      toast.success("הקישור הועתק!", {
        description: "קישור הזמנת תורים אונליין הועתק ללוח.",
      });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("לא הצלחנו להעתיק");
    }
  }

  function handleIntake() {
    router.push("/intake-forms");
  }

  const items = [
    {
      key: "new-customer",
      icon: UserPlus,
      label: "לקוח חדש",
      onClick: () => setDrawerOpen(true),
      isCenter: false,
    },
    {
      key: "leads",
      icon: Target,
      label: "לידים",
      onClick: () => router.push("/leads"),
      isCenter: false,
      active: pathname.startsWith("/leads"),
    },
    {
      key: "home",
      icon: Home,
      label: "דף הבית",
      onClick: () => router.push("/dashboard"),
      isCenter: true,
      active: isHome,
    },
    {
      key: "intake",
      icon: ClipboardList,
      label: "טופס קליטה",
      onClick: handleIntake,
      isCenter: false,
      active: pathname.startsWith("/intake-forms"),
    },
    {
      key: "booking-link",
      icon: copied === "booking" ? Check : Link2,
      label: "קישור תורים",
      onClick: handleCopyBookingLink,
      isCenter: false,
    },
  ] as const;

  return (
    <>
      {/* Spacer so page content isn't hidden behind the nav (includes iOS safe area) */}
      <div
        className="md:hidden"
        style={{ height: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden
      />

      {/* Bottom nav bar — visible only on mobile */}
      <nav
        dir="rtl"
        className={[
          "fixed bottom-0 inset-x-0 z-30 md:hidden",
          "bg-white border-t border-petra-border",
          "pb-safe",
          "shadow-[0_-4px_24px_rgba(0,0,0,0.08)]",
        ].join(" ")}
      >
        <div className="flex items-end justify-around px-2 pt-2 pb-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = "active" in item ? item.active : false;

            if (item.isCenter) {
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-1 -mt-5 relative"
                  aria-label={item.label}
                >
                  {/* Raised circle — brand orange */}
                  <div
                    className={[
                      "w-14 h-14 rounded-full flex items-center justify-center",
                      "shadow-lg shadow-brand-200 transition-transform active:scale-95",
                      isHome
                        ? "ring-2 ring-white ring-offset-1"
                        : "",
                    ].join(" ")}
                    style={{
                      background: isHome
                        ? "linear-gradient(135deg, #EA580C, #F97316)"
                        : "linear-gradient(135deg, #F97316, #FB923C)",
                    }}
                  >
                    <Icon size={26} className="text-white" strokeWidth={2} />
                  </div>
                  <span className={[
                    "text-[10px] font-medium leading-none",
                    isHome ? "text-brand-600" : "text-petra-muted",
                  ].join(" ")}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.key}
                onClick={item.onClick}
                className="flex flex-col items-center gap-1.5 px-2 py-1 rounded-xl transition-colors active:bg-brand-50"
                aria-label={item.label}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={[
                    "transition-colors",
                    active ? "text-brand-500" : "text-slate-400",
                    item.key === "booking-link" && copied === "booking"
                      ? "text-emerald-500"
                      : "",
                  ].join(" ")}
                />
                <span
                  className={[
                    "text-[10px] font-medium leading-none truncate max-w-[56px]",
                    active ? "text-brand-500" : "text-slate-400",
                    item.key === "booking-link" && copied === "booking"
                      ? "text-emerald-500"
                      : "",
                  ].join(" ")}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* New Customer Drawer */}
      <NewCustomerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
