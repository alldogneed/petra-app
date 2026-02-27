"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Search, Users, PawPrint, Calendar, Home, X, ArrowLeft,
} from "lucide-react";
import { cn, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResults {
  customers: Array<{
    id: string; name: string; phone: string; email: string | null;
  }>;
  pets: Array<{
    id: string; name: string; species: string; breed: string | null;
    customer: { id: string; name: string };
  }>;
  appointments: Array<{
    id: string; date: string; startTime: string; status: string; notes: string | null;
    service: { name: string; color: string | null };
    customer: { id: string; name: string };
    pet: { name: string } | null;
  }>;
  boarding: Array<{
    id: string; checkIn: string; checkOut: string | null; status: string;
    pet: { id: string; name: string; species: string };
    customer: { id: string; name: string };
  }>;
}

interface FlatResult {
  key: string;
  href: string;
  type: "customers" | "pets" | "appointments" | "boarding";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PET_EMOJI: Record<string, string> = { dog: "🐕", cat: "🐈" };
function petEmoji(species: string) { return PET_EMOJI[species] ?? "🐾"; }

const STATUS_BOARDING: Record<string, { label: string; color: string }> = {
  reserved:    { label: "מוזמן",  color: "bg-blue-50 text-blue-700" },
  checked_in:  { label: "שוהה",  color: "bg-emerald-50 text-emerald-700" },
  checked_out: { label: "עזב",   color: "bg-slate-100 text-slate-500" },
  cancelled:   { label: "בוטל",  color: "bg-red-50 text-red-600" },
};

function formatShortDate(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()} ${dt.toLocaleString("he", { month: "short" })}`;
}

// ─── Result item renderers ─────────────────────────────────────────────────────

function CustomerItem({ c }: { c: SearchResults["customers"][0] }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#F97316,#FB923C)" }}>
        {c.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-petra-text truncate">{c.name}</p>
        <p className="text-xs text-petra-muted" dir="ltr">{c.phone}</p>
      </div>
      <ArrowLeft className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
    </div>
  );
}

function PetItem({ p }: { p: SearchResults["pets"][0] }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
        {petEmoji(p.species)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-petra-text truncate">
          {p.name}
          {p.breed && <span className="text-petra-muted font-normal"> · {p.breed}</span>}
        </p>
        <p className="text-xs text-petra-muted truncate">של: {p.customer.name}</p>
      </div>
      <ArrowLeft className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
    </div>
  );
}

function AppointmentItem({ a }: { a: SearchResults["appointments"][0] }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-2 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: a.service.color || "#3B82F6" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-petra-text truncate">
          {a.service.name}
          {a.pet && <span className="text-petra-muted font-normal"> · {a.pet.name}</span>}
        </p>
        <p className="text-xs text-petra-muted truncate">
          {a.customer.name} · {formatDate(a.date)} {a.startTime}
        </p>
      </div>
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
        getStatusColor(a.status))}>
        {getStatusLabel(a.status)}
      </span>
    </div>
  );
}

function BoardingItem({ b }: { b: SearchResults["boarding"][0] }) {
  const s = STATUS_BOARDING[b.status] ?? STATUS_BOARDING.reserved;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-lg flex-shrink-0">
        {petEmoji(b.pet.species)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-petra-text truncate">
          {b.pet.name}
        </p>
        <p className="text-xs text-petra-muted truncate">
          {b.customer.name} · {formatShortDate(b.checkIn)}
          {b.checkOut ? ` – ${formatShortDate(b.checkOut)}` : ""}
        </p>
      </div>
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0", s.color)}>
        {s.label}
      </span>
    </div>
  );
}

// ─── Group config ─────────────────────────────────────────────────────────────

const GROUPS = [
  { key: "customers" as const,    label: "לקוחות",       Icon: Users    },
  { key: "pets" as const,         label: "חיות מחמד",    Icon: PawPrint },
  { key: "appointments" as const, label: "תורים",        Icon: Calendar },
  { key: "boarding" as const,     label: "פנסיון",       Icon: Home     },
];

function getHref(type: string, item: { id?: string; customer?: { id: string } }) {
  switch (type) {
    case "customers":    return `/customers/${item.id}`;
    case "pets":         return `/customers/${item.customer!.id}#pets`;
    case "appointments": return `/customers/${item.customer!.id}#appointments`;
    case "boarding":     return `/customers/${item.customer!.id}`;
    default:             return "/";
  }
}

// ─── SearchModal ──────────────────────────────────────────────────────────────

export function SearchModal({
  isOpen,
  onClose,
  initialQuery = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Sync when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(initialQuery);
      setDebouncedQuery(initialQuery);
      setFocusedIndex(-1);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialQuery]);

  // Debounce input → query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 250);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Reset focus when query changes
  useEffect(() => { setFocusedIndex(-1); }, [debouncedQuery]);

  // Fetch results
  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!r.ok) throw new Error("Search failed");
      return r.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Build flat results list for keyboard nav
  const flatResults = useMemo<FlatResult[]>(() => {
    if (!data) return [];
    const list: FlatResult[] = [];
    GROUPS.forEach(({ key }) => {
      (data[key] as Array<{ id: string; customer?: { id: string } }>).forEach((item) => {
        list.push({ key: `${key}-${item.id}`, href: getHref(key, item), type: key });
      });
    });
    return list;
  }, [data]);

  const hasResults = flatResults.length > 0;

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      router.push(flatResults[focusedIndex].href);
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [flatResults, focusedIndex, router, onClose]);

  if (!isOpen) return null;

  // Build per-group flat index start positions
  let cursor = 0;
  const groupsWithIndex = GROUPS.map(({ key, label, Icon }) => {
    const results = (data?.[key] ?? []) as Array<{ id: string; customer?: { id: string } }>;
    const startIndex = cursor;
    cursor += results.length;
    return { key, label, Icon, results, startIndex };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
        style={{ maxHeight: "72vh" }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-petra-border flex-shrink-0">
          {isFetching ? (
            <svg className="w-4 h-4 text-brand-500 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="חיפוש לקוחות, חיות, תורים, פנסיון..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 text-sm text-petra-text bg-transparent outline-none placeholder:text-slate-400"
            autoComplete="off"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {debouncedQuery.length < 2 ? (
            /* Prompt */
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-petra-text mb-1">חיפוש מהיר</p>
              <p className="text-xs text-petra-muted">הקלד לפחות 2 תווים לחיפוש</p>
              <div className="flex items-center justify-center gap-3 mt-4 text-xs text-petra-muted">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> לקוחות</span>
                <span className="flex items-center gap-1"><PawPrint className="w-3 h-3" /> חיות</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> תורים</span>
                <span className="flex items-center gap-1"><Home className="w-3 h-3" /> פנסיון</span>
              </div>
            </div>
          ) : !isFetching && !hasResults ? (
            /* No results */
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-petra-text mb-1">לא נמצאו תוצאות</p>
              <p className="text-xs text-petra-muted">אין תוצאות עבור &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          ) : (
            /* Result groups */
            <div className="py-2">
              {groupsWithIndex.map(({ key, label, Icon, results, startIndex }) => {
                if (results.length === 0) return null;
                return (
                  <div key={key} className="mb-1">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <Icon className="w-3.5 h-3.5 text-petra-muted" />
                      <span className="text-xs font-semibold text-petra-muted uppercase tracking-wide">
                        {label}
                      </span>
                    </div>

                    {/* Items */}
                    {results.map((item, idx) => {
                      const flatIdx = startIndex + idx;
                      const isFocused = focusedIndex === flatIdx;
                      const href = getHref(key, item as { id?: string; customer?: { id: string } });

                      return (
                        <button
                          key={item.id}
                          onClick={() => { router.push(href); onClose(); }}
                          onMouseEnter={() => setFocusedIndex(flatIdx)}
                          className={cn(
                            "w-full px-4 py-2.5 text-right transition-colors",
                            isFocused ? "bg-brand-50" : "hover:bg-slate-50"
                          )}
                        >
                          {key === "customers" && (
                            <CustomerItem c={item as SearchResults["customers"][0]} />
                          )}
                          {key === "pets" && (
                            <PetItem p={item as SearchResults["pets"][0]} />
                          )}
                          {key === "appointments" && (
                            <AppointmentItem a={item as SearchResults["appointments"][0]} />
                          )}
                          {key === "boarding" && (
                            <BoardingItem b={item as SearchResults["boarding"][0]} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer keyboard hints */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-petra-border flex items-center gap-4 text-[11px] text-petra-muted flex-shrink-0 bg-slate-50/50">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">↑↓</kbd>
              ניווט
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">↵</kbd>
              פתח
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">ESC</kbd>
              סגור
            </span>
            <span className="ms-auto text-slate-300">
              {flatResults.length} תוצאות
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
