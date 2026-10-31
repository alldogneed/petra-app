"use client";

// Search-as-you-type customer picker — server search over ALL customers (name, phone, email
// and pet name), not a client filter over the newest 50. Used by every booking/creation form
// that needs a customer: calendar, scheduler, dashboard, boarding, training.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Search, X, UserPlus } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn } from "@/lib/utils";

export interface PickerPet {
  id: string;
  name: string;
  species: string;
}

export interface PickerCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  pets: PickerPet[];
}

interface CustomerPickerProps {
  /** Selected customer id (null / "" = nothing selected). */
  value: string | null;
  /** Called with the chosen customer and the pet the query matched (when exactly one pet matched by name). */
  onSelect: (customer: PickerCustomer, matchedPetId: string | null) => void;
  /** Called when the user clears the selection (X). */
  onClear?: () => void;
  /** Known selected customer (skips the lookup of `value`). */
  selectedCustomer?: PickerCustomer | null;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  /** Hide customers without pets (forms where a dog is mandatory). */
  requirePets?: boolean;
  /** Optional "new customer" row at the bottom of the list; receives the current query. */
  onCreateNew?: (query: string) => void;
  createNewLabel?: string;
}

const DEBOUNCE_MS = 250;
const TAKE = 20;

function digitsOf(s: string): string {
  let d = s.replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}

/** Does the query match the customer itself (name / phone / email)? */
function matchesCustomer(c: PickerCustomer, q: string): boolean {
  const ql = q.toLowerCase();
  if (c.name.toLowerCase().includes(ql)) return true;
  if (c.email && c.email.toLowerCase().includes(ql)) return true;
  const qd = digitsOf(q);
  if (qd && c.phone && digitsOf(c.phone).includes(qd)) return true;
  return false;
}

function matchingPets(c: PickerCustomer, q: string): PickerPet[] {
  const ql = q.trim().toLowerCase();
  if (!ql) return [];
  return (c.pets ?? []).filter((p) => p.name.toLowerCase().includes(ql));
}

/** The pet to preselect: query matched exactly one pet by name and not the customer itself. */
export function matchedPetIdFor(c: PickerCustomer, q: string): string | null {
  const t = q.trim();
  if (!t || matchesCustomer(c, t)) return null;
  const pets = matchingPets(c, t);
  return pets.length === 1 ? pets[0].id : null;
}

async function fetchPickerCustomers(q: string): Promise<PickerCustomer[]> {
  const url = `/api/customers?full=1&take=${TAKE}` + (q ? `&search=${encodeURIComponent(q)}` : "");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load customers");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Load one customer in picker shape (shared cache key: ["customer-picker-selected", id]). */
export async function fetchPickerCustomerById(id: string): Promise<PickerCustomer | null> {
  const res = await fetch(`/api/customers/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const c = await res.json();
  if (!c?.id) return null;
  return {
    id: c.id,
    name: c.name ?? "",
    phone: c.phone ?? "",
    email: c.email ?? null,
    pets: Array.isArray(c.pets)
      ? c.pets.map((p: PickerPet) => ({ id: p.id, name: p.name, species: p.species }))
      : [],
  };
}

export function CustomerPicker({
  value,
  onSelect,
  onClear,
  selectedCustomer,
  placeholder,
  autoFocus,
  className,
  disabled,
  requirePets,
  onCreateNew,
  createNewLabel,
}: CustomerPickerProps) {
  const t = useTranslations("customers.customerPicker");
  const placeholderText = placeholder ?? t("placeholder");
  const createNewText = createNewLabel ?? t("createNew");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<PickerCustomer | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Outside click closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const { data: results = [], isLoading, isFetching } = useQuery<PickerCustomer[]>({
    queryKey: ["customer-picker", debounced],
    queryFn: () => fetchPickerCustomers(debounced),
    enabled: open && !disabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => (requirePets ? results.filter((c) => (c.pets?.length ?? 0) > 0) : results),
    [results, requirePets]
  );

  useEffect(() => { setActive(0); }, [debounced, rows.length]);

  // Resolve the selected customer: explicit prop → last pick → lookup by id
  const known =
    (selectedCustomer && selectedCustomer.id === value ? selectedCustomer : null) ??
    (picked && picked.id === value ? picked : null) ??
    (value ? rows.find((c) => c.id === value) ?? null : null);

  const { data: fetchedSelected } = useQuery<PickerCustomer | null>({
    queryKey: ["customer-picker-selected", value],
    queryFn: () => fetchPickerCustomerById(value as string),
    enabled: !!value && !known,
    staleTime: 60_000,
  });
  const selected = known ?? (fetchedSelected && fetchedSelected.id === value ? fetchedSelected : null);

  const choose = (c: PickerCustomer) => {
    const petId = matchedPetIdFor(c, query.trim() || debounced);
    setPicked(c);
    setOpen(false);
    setQuery("");
    setDebounced("");
    onSelect(c, petId);
  };

  const clear = () => {
    setPicked(null);
    setQuery("");
    setDebounced("");
    onClear?.();
    setTimeout(() => {
      inputRef.current?.focus();
      setOpen(true);
    }, 0);
  };

  const totalItems = rows.length + (onCreateNew ? 1 : 0);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((i) => (totalItems ? (i + 1) % totalItems : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (totalItems ? (i - 1 + totalItems) % totalItems : 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      if (active < rows.length) {
        const c = rows[active];
        if (c) choose(c);
      } else if (onCreateNew) {
        setOpen(false);
        onCreateNew(query.trim());
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  // Keep the active row visible
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // ── Selected state ──
  if (value && selected) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 w-full rounded-xl border border-petra-border bg-white px-3 py-2.5",
          disabled && "opacity-60",
          className
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-petra-text truncate">{selected.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-petra-muted">
            {selected.phone && <span dir="ltr">{selected.phone}</span>}
            {selected.pets?.length > 0 && (
              <span className="truncate">🐕 {selected.pets.map((p) => p.name).join(", ")}</span>
            )}
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted flex-shrink-0"
            aria-label={t("change")}
            title={t("change")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  const q = query.trim();
  const showLoader = isLoading || (isFetching && rows.length === 0);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          className="input ps-9"
          placeholder={value ? t("loadingCustomer") : placeholderText}
          value={query}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-petra-border rounded-xl shadow-lg overflow-hidden">
          {showLoader ? (
            <PetraLoader variant="inline" className="py-4" />
          ) : (
            <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto">
              {!q && rows.length > 0 && (
                <li className="px-3 pt-2 pb-1 text-[11px] font-medium text-petra-muted">{t("recent")}</li>
              )}
              {rows.map((c, idx) => {
                const petHits = q ? new Set(matchingPets(c, q).map((p) => p.id)) : new Set<string>();
                return (
                  <li key={c.id} data-idx={idx} role="option" aria-selected={idx === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(c)}
                      className={cn(
                        "w-full text-start px-3 py-2.5 min-h-[48px] border-b border-slate-50 last:border-0 transition-colors",
                        idx === active ? "bg-orange-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-petra-text truncate">{c.name}</span>
                        {c.phone && (
                          <span className="text-xs text-petra-muted flex-shrink-0" dir="ltr">{c.phone}</span>
                        )}
                      </div>
                      {c.pets?.length > 0 && (
                        <div className="text-xs text-petra-muted mt-0.5 truncate">
                          🐕{" "}
                          {c.pets.map((p, i) => (
                            <span key={p.id}>
                              {i > 0 && ", "}
                              <span className={petHits.has(p.id) ? "font-semibold text-orange-600" : undefined}>
                                {p.name}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
              {rows.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-petra-muted">{t("noResults")}</li>
              )}
              {onCreateNew && (
                <li data-idx={rows.length}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(rows.length)}
                    onClick={() => {
                      setOpen(false);
                      onCreateNew(q);
                    }}
                    className={cn(
                      "w-full text-start px-3 py-3 text-sm font-medium text-brand-600 flex items-center gap-2 border-t border-slate-100",
                      active === rows.length ? "bg-orange-50" : "hover:bg-slate-50"
                    )}
                  >
                    <UserPlus className="w-4 h-4" />
                    {createNewText}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomerPicker;
