"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  PawPrint,
  Plus,
  X,
  CreditCard,
  GraduationCap,
  Target,
  Pencil,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { cn, formatDate, formatCurrency, getStatusColor, getStatusLabel, getTimelineIcon, toWhatsAppPhone } from "@/lib/utils";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  weight: number | null;
  gender: string | null;
}

interface PaymentInfo {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  appointment: { service: { name: string } } | null;
  boardingStay: { pet: { name: string }; room: { name: string } | null } | null;
}

interface TrainingGoal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
}

interface TrainingProgramInfo {
  id: string;
  name: string;
  programType: string;
  status: string;
  totalSessions: number;
  dog: { name: string } | null;
  goals: TrainingGoal[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  tags: string;
  createdAt: string;
  pets: Pet[];
  appointments: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    service: { name: string; color: string | null };
    pet: { name: string; species: string } | null;
  }[];
  payments: PaymentInfo[];
  trainingPrograms: TrainingProgramInfo[];
  timelineEvents: {
    id: string;
    type: string;
    description: string;
    createdAt: string;
  }[];
}

function AddPetModal({ customerId, isOpen, onClose }: { customerId: string; isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", species: "dog", breed: "", gender: "", weight: "" });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/customers/${customerId}/pets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
      setForm({ name: "", species: "dog", breed: "", gender: "", weight: "" });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">חיית מחמד חדשה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג</label>
              <select className="input" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
                <option value="dog">כלב</option>
                <option value="cat">חתול</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div>
              <label className="label">גזע</label>
              <input className="input" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מין</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </div>
            <div>
              <label className="label">משקל (ק״ג)</label>
              <input className="input" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={!form.name || mutation.isPending} onClick={() => mutation.mutate(form)}>
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "הוסף"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({ customer, isOpen, onClose }: { customer: CustomerDetail; isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    address: customer.address || "",
    notes: customer.notes || "",
    tags: (() => { try { return JSON.parse(customer.tags).join(", "); } catch { return ""; } })(),
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">עריכת לקוח</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">תגיות (מופרדות בפסיקים)</label>
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, בוקר, כלב גדול" />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => mutation.mutate({
              name: form.name,
              phone: form.phone,
              email: form.email || null,
              address: form.address || null,
              notes: form.notes || null,
              tags: JSON.stringify(form.tags.split(",").map(t => t.trim()).filter(Boolean)),
            })}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  bit: "ביט",
  check: "צ׳ק",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "badge-success",
  pending: "badge-warning",
  overdue: "badge-danger",
  canceled: "badge-neutral",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "שולם",
  pending: "ממתין",
  overdue: "באיחור",
  canceled: "בוטל",
};

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  BASIC_OBEDIENCE: "ציות בסיסי",
  REACTIVITY: "ריאקטיביות",
  PUPPY: "גור",
  BEHAVIOR: "התנהגות",
  ADVANCED: "מתקדם",
  CUSTOM: "מותאם אישית",
};

const PROGRAM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "פעיל",
  PAUSED: "מושהה",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
};

const PROGRAM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "badge-success",
  PAUSED: "badge-warning",
  COMPLETED: "badge-brand",
  CANCELED: "badge-neutral",
};

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = params.id as string;
  const [showPetModal, setShowPetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () => fetch(`/api/customers/${customerId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="lg:col-span-2 h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!customer) return <div className="text-center py-12 text-petra-muted">לקוח לא נמצא</div>;

  const tags: string[] = (() => { try { return JSON.parse(customer.tags); } catch { return []; } })();

  return (
    <div className="space-y-6">
      {/* Back + Name */}
      <div className="flex items-center gap-3">
        <Link href="/customers" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-petra-muted transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-petra-text">{customer.name}</h1>
          <p className="text-sm text-petra-muted">נוסף {formatDate(customer.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-petra-text">פרטי קשר</h2>
            <button
              onClick={() => setShowEditModal(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-colors"
              title="ערוך לקוח"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-petra-muted" />
              <span className="text-sm">{customer.phone}</span>
              <a
                href={`https://wa.me/${toWhatsAppPhone(customer.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-auto flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-petra-muted" />
                <span className="text-sm">{customer.email}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-petra-muted" />
                <span className="text-sm">{customer.address}</span>
              </div>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {tags.map((tag) => (
                <span key={tag} className="badge-brand">{tag}</span>
              ))}
            </div>
          )}
          {customer.notes && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm text-petra-muted">{customer.notes}</p>
            </div>
          )}

          {/* Quick stats */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <p className="text-lg font-bold text-petra-text">{customer.appointments.length}</p>
              <p className="text-[10px] text-petra-muted">תורים</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <p className="text-lg font-bold text-petra-text">{customer.pets.length}</p>
              <p className="text-[10px] text-petra-muted">חיות</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <p className="text-lg font-bold text-brand-500">
                {formatCurrency((customer.payments || []).filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0))}
              </p>
              <p className="text-[10px] text-petra-muted">שולם</p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pets */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">חיות מחמד ({customer.pets.length})</h2>
              <button className="btn-ghost text-xs" onClick={() => setShowPetModal(true)}>
                <Plus className="w-3.5 h-3.5" />
                הוסף
              </button>
            </div>
            {customer.pets.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">אין חיות מחמד</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customer.pets.map((pet) => (
                  <div key={pet.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                      <PawPrint className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-petra-text">{pet.name}</div>
                      <div className="text-xs text-petra-muted">
                        {pet.species === "dog" ? "כלב" : pet.species === "cat" ? "חתול" : pet.species}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                        {pet.gender ? ` · ${pet.gender === "male" ? "זכר" : "נקבה"}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Appointments */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-petra-text mb-4">תורים ({customer.appointments.length})</h2>
            {customer.appointments.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">אין תורים</p>
            ) : (
              <div className="space-y-2">
                {customer.appointments.slice(0, 10).map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div
                      className="w-1.5 h-8 rounded-full flex-shrink-0"
                      style={{ background: apt.service.color || "#F97316" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-petra-text">{apt.service.name}</div>
                      <div className="text-xs text-petra-muted">
                        {new Date(apt.date).toLocaleDateString("he-IL")} · {apt.startTime}
                        {apt.pet ? ` · ${apt.pet.name}` : ""}
                      </div>
                    </div>
                    <span className={cn("badge text-[10px]", getStatusColor(apt.status))}>
                      {getStatusLabel(apt.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          {(customer.payments || []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-petra-muted" />
                  תשלומים ({customer.payments.length})
                </h2>
                <Link href="/payments" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  הכל
                </Link>
              </div>
              <div className="space-y-2">
                {customer.payments.slice(0, 8).map((payment) => (
                  <div key={payment.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-petra-text">
                        {formatCurrency(payment.amount)}
                        <span className="text-xs text-petra-muted mr-1">
                          · {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                        </span>
                      </div>
                      <div className="text-xs text-petra-muted">
                        {payment.appointment?.service?.name ||
                          (payment.boardingStay ? `פנסיון – ${payment.boardingStay.pet?.name}` : "")}
                        {" · "}
                        {new Date(payment.paidAt || payment.createdAt).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                    <span className={cn("badge text-[10px]", PAYMENT_STATUS_COLORS[payment.status] || "badge-neutral")}>
                      {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Training Programs */}
          {(customer.trainingPrograms || []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-petra-muted" />
                  תוכניות אימון ({customer.trainingPrograms.length})
                </h2>
                <Link href="/training" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  הכל
                </Link>
              </div>
              <div className="space-y-3">
                {customer.trainingPrograms.map((program) => (
                  <div key={program.id} className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-petra-text">{program.name}</span>
                        {program.dog && (
                          <span className="text-xs text-petra-muted mr-1">· {program.dog.name}</span>
                        )}
                      </div>
                      <span className={cn("badge text-[10px]", PROGRAM_STATUS_COLORS[program.status] || "badge-neutral")}>
                        {PROGRAM_STATUS_LABELS[program.status] || program.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-petra-muted mb-2">
                      <span>{PROGRAM_TYPE_LABELS[program.programType] || program.programType}</span>
                      <span>·</span>
                      <span>{program.totalSessions} מפגשים</span>
                    </div>
                    {program.goals.length > 0 && (
                      <div className="space-y-1.5">
                        {program.goals.slice(0, 3).map((goal) => (
                          <div key={goal.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs text-petra-text">{goal.title}</span>
                                <span className="text-[10px] text-petra-muted">{goal.progressPercent}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${goal.progressPercent}%`,
                                    background: goal.progressPercent >= 100 ? "#10B981" : "#F97316",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-petra-text mb-4">ציר זמן</h2>
            {customer.timelineEvents.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">אין אירועים</p>
            ) : (
              <div className="space-y-3">
                {customer.timelineEvents.map((event) => {
                  const Icon = getTimelineIcon(event.type);
                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm text-petra-text">{event.description}</p>
                        <p className="text-xs text-petra-muted mt-0.5">
                          {new Date(event.createdAt).toLocaleDateString("he-IL")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AddPetModal customerId={customerId} isOpen={showPetModal} onClose={() => setShowPetModal(false)} />
      <EditCustomerModal customer={customer} isOpen={showEditModal} onClose={() => setShowEditModal(false)} />
    </div>
  );
}
