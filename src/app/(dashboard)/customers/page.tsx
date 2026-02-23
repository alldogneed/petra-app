"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  PawPrint,
  Calendar,
  X,
  ChevronLeft,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string;
  createdAt: string;
  _count: { pets: number; appointments: number };
}

function NewCustomerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    tags: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      setForm({ name: "", phone: "", email: "", notes: "", tags: "" });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">לקוח חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף לקוח למערכת</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם מלא *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="שם הלקוח" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">תגיות</label>
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, אילוף בסיסי" />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "הוסף לקוח"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      return fetch(`/api/customers?${params}`).then((r) => r.json());
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">לקוחות</h1>
          <p className="text-sm text-petra-muted mt-1">{customers.length} לקוחות במערכת</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          לקוח חדש
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון או אימייל..."
            className="input pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-50 animate-pulse">
              <div className="w-10 h-10 bg-slate-100 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין לקוחות</h3>
          <p className="text-sm text-petra-muted mb-4">התחל על ידי הוספת הלקוח הראשון</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            הוסף לקוח
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-petra-border">
                <th className="table-header-cell">שם</th>
                <th className="table-header-cell hidden sm:table-cell">טלפון</th>
                <th className="table-header-cell hidden md:table-cell">אימייל</th>
                <th className="table-header-cell hidden lg:table-cell">חיות</th>
                <th className="table-header-cell hidden lg:table-cell">תורים</th>
                <th className="table-header-cell w-10"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const tags: string[] = (() => {
                  try { return JSON.parse(customer.tags); }
                  catch { return []; }
                })();

                return (
                  <tr key={customer.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="table-cell">
                      <Link href={`/customers/${customer.id}`} className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #F97316, #FB923C)" }}
                        >
                          {customer.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-petra-text">{customer.name}</span>
                          {tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="badge-neutral text-[10px]">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className="text-sm text-petra-muted flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </span>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <span className="text-sm text-petra-muted flex items-center gap-1">
                        {customer.email ? (
                          <><Mail className="w-3 h-3" />{customer.email}</>
                        ) : "—"}
                      </span>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <span className="text-sm text-petra-muted flex items-center gap-1">
                        <PawPrint className="w-3 h-3" />
                        {customer._count.pets}
                      </span>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <span className="text-sm text-petra-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {customer._count.appointments}
                      </span>
                    </td>
                    <td className="table-cell">
                      <Link href={`/customers/${customer.id}`}>
                        <ChevronLeft className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewCustomerModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
