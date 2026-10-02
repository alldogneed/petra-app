"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowLeft, MessageCircle, UserX, TrendingDown } from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";


// ─── At-Risk Customers Widget ─────────────────────────────────────────────────

export function AtRiskCustomersWidget({ customers }: { customers: DashboardStats["atRiskCustomers"] }) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  if (!customers || customers.length === 0) return null;

  function buildMsg(c: DashboardStats["atRiskCustomers"][0]) {
    return `שלום ${c.name}! 🐾\nזמן רב לא ראינו אתכם, מתגעגעים!\nהאם תרצו לקבוע תור? נשמח לראות אתכם שוב 😊`;
  }

  function handleBulkSend() {
    setBulkSending(true);
    const withPhone = customers.filter((c) => c.phone);
    withPhone.forEach((c, i) => {
      setTimeout(() => {
        const text = encodeURIComponent(buildMsg(c));
        window.open(`https://wa.me/${toWhatsAppPhone(c.phone)}?text=${text}`, "_blank");
        setSentIds((prev) => new Set([...prev, c.id]));
        if (i === withPhone.length - 1) setBulkSending(false);
      }, i * 700);
    });
  }

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #F97316" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-orange-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100">
            <TrendingDown className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">לקוחות בסיכון אי-חזרה</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-orange-600 font-medium">{customers.length} לקוחות</span>{" "}
              לא ביקרו 60+ יום
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkSend}
            disabled={bulkSending || customers.filter((c) => c.phone).length === 0}
            className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
            title="שלח הודעות לכל הלקוחות ברשימה"
          >
            <MessageCircle className="w-3 h-3" />
            שלח לכולם
          </button>
          <Link
            href="/customers"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
          >
            כל הלקוחות
            <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {customers.map((c) => {
          const sent = sentIds.has(c.id);
          const waMsg = buildMsg(c);
          const waLink = `https://wa.me/${toWhatsAppPhone(c.phone)}?text=${encodeURIComponent(waMsg)}`;
          const urgency = c.daysSinceVisit >= 120 ? "text-red-600" : "text-orange-600";

          return (
            <div key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <UserX className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/customers/${c.id}`}
                  className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block"
                >
                  {c.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-medium", urgency)}>
                    לא ביקר {c.daysSinceVisit} ימים
                  </span>
                  <span className="text-[11px] text-petra-muted">
                    · {c.totalVisits} ביקורים סה&quot;כ
                  </span>
                </div>
              </div>
              {c.phone && (
                sent ? (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    נשלח
                  </span>
                ) : (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSentIds((prev) => new Set([...prev, c.id]))}
                    className="w-7 h-7 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors flex-shrink-0"
                    title="שלח הודעת חזרה בוואטסאפ"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
