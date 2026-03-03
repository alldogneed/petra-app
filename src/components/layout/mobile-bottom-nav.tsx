"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Hotel,
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

  // Auto-focus when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 300);
    } else {
      setName("");
      setPhone("");
    }
  }, [open]);

  // Close on backdrop click
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
          <h2 className="text-base font-bold text-slate-800">לקוח חדש</h2>
          <div className="w-8" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pt-5 pb-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5 text-right">
              שם מלא <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              dir="rtl"
              className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5 text-right">
              טלפון <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
              className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
            className={[
              "w-full h-12 rounded-xl font-semibold text-white text-sm",
              "flex items-center justify-center gap-2",
              "transition-all duration-150",
              loading || !name.trim() || !phone.trim()
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 active:scale-[0.98] shadow-md shadow-blue-200",
            ].join(" ")}
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

  // Close the drawer whenever the user navigates to a new page
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

  // ── Items definition ──────────────────────────────────────────────────────
  const items = [
    {
      key: "new-customer",
      icon: UserPlus,
      label: "לקוח חדש",
      onClick: () => setDrawerOpen(true),
      isCenter: false,
    },
    {
      key: "boarding",
      icon: Hotel,
      label: "פנסיון",
      onClick: () => router.push("/boarding"),
      isCenter: false,
      active: pathname.startsWith("/boarding"),
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
      {/* Spacer so page content isn't hidden behind the nav */}
      <div className="h-20 md:hidden" aria-hidden />

      {/* Bottom nav bar — visible only on mobile */}
      <nav
        dir="rtl"
        className={[
          "fixed bottom-0 inset-x-0 z-30 md:hidden",
          "bg-white border-t border-slate-100",
          "pb-safe", // safe-area for iOS home indicator
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
                  {/* Raised circle */}
                  <div
                    className={[
                      "w-14 h-14 rounded-full flex items-center justify-center",
                      "shadow-lg shadow-blue-200 transition-transform active:scale-95",
                      isHome
                        ? "bg-blue-700 ring-2 ring-white ring-offset-1"
                        : "bg-blue-600",
                    ].join(" ")}
                  >
                    <Icon size={26} className="text-white" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 leading-none">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.key}
                onClick={item.onClick}
                className="flex flex-col items-center gap-1.5 px-2 py-1 rounded-xl transition-colors active:bg-slate-50"
                aria-label={item.label}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={[
                    "transition-colors",
                    active ? "text-blue-600" : "text-slate-400",
                    item.key === "booking-link" && copied === "booking"
                      ? "text-green-500"
                      : "",
                  ].join(" ")}
                />
                <span
                  className={[
                    "text-[10px] font-medium leading-none",
                    active ? "text-blue-600" : "text-slate-400",
                    item.key === "booking-link" && copied === "booking"
                      ? "text-green-500"
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
