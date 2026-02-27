"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  QrCode,
  Eye,
  Printer,
  X,
  ChevronLeft,
  Dog,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SERVICE_DOG_PHASE_COLORS, SERVICE_DOG_PHASE_MAP } from "@/lib/service-dogs";
import { toast } from "sonner";

interface ServiceDogSummary {
  id: string;
  phase: string;
  idCardIsActive: boolean;
  registrationNumber: string | null;
  certificationDate: string | null;
  certificationExpiry: string | null;
  pet: { name: string; breed: string | null };
}

interface IDCard {
  id: string;
  qrToken: string;
  qrPayload: string;
  cardDataJson: string;
  isActive: boolean;
  expiresAt: string | null;
  generatedAt: string;
}

export default function IDCardsPage() {
  const [viewingCard, setViewingCard] = useState<{ card: IDCard; dogName: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: dogs = [], isLoading } = useQuery<ServiceDogSummary[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: (dogId: string) =>
      fetch(`/api/service-dogs/${dogId}/id-card`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("תעודת זהות הונפקה בהצלחה");
    },
    onError: () => toast.error("שגיאה בהנפקת תעודה"),
  });

  const fetchAndViewCard = async (dogId: string, dogName: string) => {
    try {
      const res = await fetch(`/api/service-dogs/${dogId}/id-card`);
      if (res.ok) {
        const card = await res.json();
        setViewingCard({ card, dogName });
      } else {
        toast.error("לא נמצאה תעודה");
      }
    } catch {
      toast.error("שגיאה בטעינת התעודה");
    }
  };

  const certifiedDogs = dogs.filter((d) => d.phase === "CERTIFIED");
  const dogsWithCards = dogs.filter((d) => d.idCardIsActive);
  const certifiedWithoutCards = certifiedDogs.filter((d) => !d.idCardIsActive);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>תעודות זהות</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-brand-500" />
            תעודות זהות
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dogsWithCards.length} תעודות פעילות · {certifiedWithoutCards.length} מוסמכים ללא תעודה
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-600">{dogsWithCards.length}</div>
          <div className="text-xs text-emerald-700 mt-0.5">תעודות פעילות</div>
        </div>
        <div className="rounded-xl p-4 border bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{certifiedDogs.length}</div>
          <div className="text-xs text-blue-700 mt-0.5">כלבים מוסמכים</div>
        </div>
        <div className={cn(
          "rounded-xl p-4 border",
          certifiedWithoutCards.length > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/30"
        )}>
          <div className={cn("text-2xl font-bold", certifiedWithoutCards.length > 0 ? "text-amber-600" : "text-slate-500")}>
            {certifiedWithoutCards.length}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">ממתינים לתעודה</div>
        </div>
        <div className="rounded-xl p-4 border bg-muted/30">
          <div className="text-2xl font-bold text-slate-500">
            {dogs.filter((d) => !["CERTIFIED", "RETIRED"].includes(d.phase)).length}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">בתהליך הכשרה</div>
        </div>
      </div>

      {/* Certified without cards */}
      {certifiedWithoutCards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-amber-700">
              כלבים מוסמכים ללא תעודת זהות ({certifiedWithoutCards.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {certifiedWithoutCards.map((dog) => (
              <div
                key={dog.id}
                className="card p-4 border-amber-200 bg-amber-50 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Dog className="w-4 h-4 text-amber-600" />
                    <Link
                      href={`/service-dogs/${dog.id}`}
                      className="font-medium hover:text-brand-600 transition-colors"
                    >
                      {dog.pet.name}
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dog.pet.breed || "—"}
                    {dog.certificationDate && ` · הוסמך ${formatDate(dog.certificationDate)}`}
                  </p>
                </div>
                <button
                  onClick={() => generateMutation.mutate(dog.id)}
                  disabled={generateMutation.isPending && generateMutation.variables === dog.id}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  הנפק
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active cards grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <h3 className="font-semibold">תעודות פעילות ({dogsWithCards.length})</h3>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="card animate-pulse h-40" />)}
          </div>
        ) : dogsWithCards.length === 0 ? (
          <div className="empty-state py-10">
            <CreditCard className="empty-state-icon" />
            <p className="text-muted-foreground">אין תעודות פעילות</p>
            {certifiedDogs.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                יש להסמיך כלבים לפני הנפקת תעודות
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dogsWithCards.map((dog) => {
              const phaseColors = SERVICE_DOG_PHASE_COLORS[dog.phase];
              return (
                <div
                  key={dog.id}
                  className="card p-0 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Card header */}
                  <div
                    className="px-4 py-3 border-b"
                    style={{ backgroundColor: phaseColors?.bg || "#F8FAFC" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/service-dogs/${dog.id}`}
                          className="font-bold hover:text-brand-600 flex items-center gap-1.5"
                        >
                          <Shield className="w-4 h-4" style={{ color: phaseColors?.text }} />
                          {dog.pet.name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dog.pet.breed || "—"}
                        </p>
                      </div>
                      <span className="badge-success text-xs">תעודה פעילה</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">שלב</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: phaseColors?.bg,
                          color: phaseColors?.text,
                          borderColor: phaseColors?.border,
                        }}
                      >
                        {SERVICE_DOG_PHASE_MAP[dog.phase]?.label || dog.phase}
                      </span>
                    </div>
                    {dog.registrationNumber && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">מספר רישום</span>
                        <span className="font-mono text-xs">{dog.registrationNumber}</span>
                      </div>
                    )}
                    {dog.certificationDate && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">תאריך הסמכה</span>
                        <span className="text-xs">{formatDate(dog.certificationDate)}</span>
                      </div>
                    )}
                    {dog.certificationExpiry && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">תוקף</span>
                        <span
                          className={cn(
                            "text-xs",
                            new Date(dog.certificationExpiry) < new Date()
                              ? "text-red-600 font-medium"
                              : "text-emerald-600"
                          )}
                        >
                          {formatDate(dog.certificationExpiry)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="px-4 py-2.5 border-t bg-muted/20 flex gap-2">
                    <button
                      onClick={() => fetchAndViewCard(dog.id, dog.pet.name)}
                      className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      צפה
                    </button>
                    <button
                      onClick={() => fetchAndViewCard(dog.id, dog.pet.name)}
                      className="btn-ghost text-sm flex items-center gap-1.5 px-3"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Card Modal */}
      {viewingCard && (
        <div className="modal-overlay" onClick={() => setViewingCard(null)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-500" />
                תעודת כלב שירות
              </h2>
              <button onClick={() => setViewingCard(null)} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dog name */}
            <div className="bg-slate-800 text-white rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-400 mb-1">שם הכלב</p>
              <p className="text-2xl font-bold">{viewingCard.dogName}</p>
            </div>

            {/* QR Code */}
            {viewingCard.card.qrPayload && (
              <div className="bg-white border rounded-xl p-4 mb-4 flex justify-center">
                <img
                  src={viewingCard.card.qrPayload}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            )}

            {/* Card details */}
            {(() => {
              const data = JSON.parse(viewingCard.card.cardDataJson || "{}");
              const fields = [
                { label: "גזע", value: data.breed },
                { label: "מספר רישום", value: data.registrationNumber },
                { label: "גוף מסמיך", value: data.certifyingBody },
                { label: "מקבל", value: data.recipientName },
                { label: "תאריך הסמכה", value: data.certificationDate ? formatDate(data.certificationDate) : null },
              ].filter((f) => f.value);

              return fields.length > 0 ? (
                <div className="text-right space-y-1.5 mb-4 border rounded-xl p-3">
                  {fields.map((f) => (
                    <div key={f.label} className="flex justify-between text-sm">
                      <span className="font-medium">{f.value}</span>
                      <span className="text-muted-foreground">{f.label}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                הדפס תעודה
              </button>
              <button onClick={() => setViewingCard(null)} className="btn-secondary flex-1">
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
