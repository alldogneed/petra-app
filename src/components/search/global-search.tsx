"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, PawPrint, Calendar, Hotel, X, Loader2, UserPlus, CheckSquare } from "lucide-react";
interface SearchResults {
  customers: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  }[];
  pets: {
    id: string;
    name: string;
    breed: string | null;
    species: string;
    customer: { id: string; name: string };
  }[];
  appointments: {
    id: string;
    date: string;
    startTime: string;
    customer: { name: string };
    service: { name: string } | null;
    priceListItem: { name: string } | null;
  }[];
  boarding: {
    id: string;
    checkIn: string;
    pet: { name: string };
    customer: { name: string };
    room: { name: string } | null;
  }[];
  leads: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    stage: string;
    wonAt: string | null;
    lostAt: string | null;
    leadStage: { name: string } | null;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
  }[];
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout>();

  // Keyboard shortcut ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setResults(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const navigate = (path: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(path);
  };

  const totalResults =
    results
      ? results.customers.length +
        results.pets.length +
        results.appointments.length +
        results.boarding.length +
        results.leads.length +
        results.tasks.length
      : 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full max-w-xs md:max-w-sm"
      >
        <div className="relative">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "#94a3b8" }}
          />
          <div
            className="w-full pr-10 pl-4 py-2 text-sm rounded-xl border text-right cursor-pointer"
            style={{
              background: "rgba(241,245,249,0.8)",
              borderColor: "#E2E8F0",
              color: "#94a3b8",
            }}
          >
            חיפוש מהיר... <span className="hidden sm:inline">(⌘K)</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setQuery("");
          setResults(null);
        }}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4">
        <div
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100">
            {loading ? (
              <Loader2 className="w-5 h-5 text-brand-500 animate-spin flex-shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
            )}
            <label htmlFor="global-search" className="sr-only">חיפוש</label>
            <input
              ref={inputRef}
              id="global-search"
              type="search"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="חפש לקוח, חיית מחמד, תור, ליד, משימה..."
              className="flex-1 text-sm text-petra-text bg-transparent border-none outline-none placeholder-slate-400"
              dir="rtl"
              aria-label="חיפוש"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {query.length >= 2 && results && totalResults === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-petra-muted">לא נמצאו תוצאות עבור &quot;{query}&quot;</p>
              </div>
            )}

            {results && results.customers.length > 0 && (
              <ResultSection
                title="לקוחות"
                icon={Users}
                items={results.customers.map((c) => ({
                  id: c.id,
                  title: c.name,
                  subtitle: c.phone + (c.email ? ` · ${c.email}` : ""),
                  onClick: () => navigate(`/customers/${c.id}`),
                }))}
              />
            )}

            {results && results.pets.filter((p) => p.customer != null).length > 0 && (
              <ResultSection
                title="חיות מחמד"
                icon={PawPrint}
                items={results.pets.filter((p) => p.customer != null).map((p) => ({
                  id: p.id,
                  title: `${p.name} (${p.species === "dog" ? "כלב" : p.species === "cat" ? "חתול" : p.species})`,
                  subtitle: `${p.customer!.name}${p.breed ? ` · ${p.breed}` : ""}`,
                  onClick: () => navigate(`/customers/${p.customer!.id}`),
                }))}
              />
            )}

            {results && results.appointments.filter((a) => a.customer != null && (a.service != null || a.priceListItem != null)).length > 0 && (
              <ResultSection
                title="תורים"
                icon={Calendar}
                items={results.appointments.filter((a) => a.customer != null && (a.service != null || a.priceListItem != null)).map((a) => ({
                  id: a.id,
                  title: `${a.customer!.name} – ${a.service?.name ?? a.priceListItem?.name ?? "תור"}`,
                  subtitle: `${new Date(a.date).toLocaleDateString("he-IL")} ${a.startTime}`,
                  onClick: () => navigate(`/calendar`),
                }))}
              />
            )}

            {results && results.boarding.filter((b) => b.customer != null && b.pet != null).length > 0 && (
              <ResultSection
                title="פנסיון"
                icon={Hotel}
                items={results.boarding.filter((b) => b.customer != null && b.pet != null).map((b) => ({
                  id: b.id,
                  title: `${b.customer!.name} – ${b.pet!.name}`,
                  subtitle: `${new Date(b.checkIn).toLocaleDateString("he-IL")}${b.room ? ` · ${b.room.name}` : ""}`,
                  onClick: () => navigate(`/boarding`),
                }))}
              />
            )}

            {results && results.leads.length > 0 && (
              <ResultSection
                title="לידים"
                icon={UserPlus}
                items={results.leads.map((l) => ({
                  id: l.id,
                  title: l.name,
                  subtitle: `${l.phone}${l.email ? ` · ${l.email}` : ""} · ${
                    l.wonAt ? "נסגר בהצלחה" :
                    l.lostAt ? "אבוד" :
                    l.leadStage?.name ?? "חדש"
                  }`,
                  onClick: () => navigate(`/leads`),
                }))}
              />
            )}

            {results && results.tasks.length > 0 && (
              <ResultSection
                title="משימות"
                icon={CheckSquare}
                items={results.tasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  subtitle: `${
                    t.priority === "URGENT" ? "דחוף" :
                    t.priority === "HIGH" ? "גבוה" :
                    t.priority === "MEDIUM" ? "בינוני" : "נמוך"
                  }${t.dueDate ? ` · ${new Date(t.dueDate).toLocaleDateString("he-IL")}` : ""}`,
                  onClick: () => navigate(`/tasks`),
                }))}
              />
            )}

            {!results && query.length < 2 && (
              <div className="p-6 text-center">
                <p className="text-sm text-petra-muted">הקלד לפחות 2 תווים לחיפוש</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ResultSection({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: { id: string; title: string; subtitle: string; onClick: () => void }[];
}) {
  return (
    <div className="border-b border-slate-50 last:border-0">
      <div className="px-4 py-2 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-petra-muted" />
        <span className="text-xs font-medium text-petra-muted uppercase tracking-wider">
          {title}
        </span>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-right"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-petra-text truncate">
              {item.title}
            </div>
            <div className="text-xs text-petra-muted truncate">{item.subtitle}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
