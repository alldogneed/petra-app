"use client";
import { PageTitle } from "@/components/ui/PageTitle";
import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, ShoppingCart, UserPlus, CalendarClock, Copy, ClipboardCheck, RefreshCw, Tag, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, fetchJSON, cn, toWhatsAppPhone, copyToClipboard } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  DashCard,
  DashCardHeader,
  DashLink,
  DashRow,
  DashEmpty,
  Segmented,
  WaIconButton,
  TaskCheckbox,
  PriorityDot,
} from "@/components/dashboard/dash-ui";
import { defaultDashboardPrefs, layoutBlocks as computeLayout, visibleBlocks, visibleStats, DASHBOARD_PREFS_QUERY_KEY, type DashboardBlockId, type DashboardPrefsResponse, type RequirementFlags } from "@/lib/dashboard-widgets";
import { TASK_CATEGORY_LABELS, DashboardStats, ActivityItem, SERVICE_TYPE_TABS, CATEGORY_TO_FILTER, ORDER_TYPE_INFO, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/components/dashboard/dashboard-shared";
import { AppointmentRow } from "@/components/dashboard/widgets/UpcomingAppointments";
import { ActivityFeed } from "@/components/dashboard/widgets/ActivityFeed";
import { DailyFocusSection } from "@/components/dashboard/widgets/DailyFocus";
import { TodayFollowUpsWidget, UrgentLeadsAlert } from "@/components/dashboard/widgets/LeadAlerts";
import { TopDebtorsWidget } from "@/components/dashboard/widgets/TopDebtors";
import { TomorrowReminders } from "@/components/dashboard/widgets/TomorrowReminders";
import { VaccinationAlertWidget } from "@/components/dashboard/widgets/Vaccinations";
import { MedicationsWidget } from "@/components/dashboard/widgets/Medications";
import { AtRiskCustomersWidget } from "@/components/dashboard/widgets/AtRiskCustomers";
import { PetBirthdaysWidget } from "@/components/dashboard/widgets/PetBirthdays";
import { NewCustomerModal } from "@/components/dashboard/NewCustomerModal";
import { NewAppointmentModal } from "@/components/dashboard/NewAppointmentModal";
import dynamic from "next/dynamic";
const SetupChecklist = dynamic(
  () => import("@/components/onboarding/SetupChecklist").then((m) => ({ default: m.SetupChecklist })),
  { ssr: false }
);
const TeamWelcomeModal = dynamic(
  () => import("@/components/onboarding/TeamWelcomeModal").then((m) => ({ default: m.TeamWelcomeModal })),
  { ssr: false }
);
const OnboardingWizardModal = dynamic(
  () => import("@/components/onboarding/OnboardingWizardModal"),
  { ssr: false }
);
const DashboardCustomizeModal = dynamic(
  () => import("@/components/dashboard/DashboardCustomizeModal").then((m) => m.DashboardCustomizeModal),
  { ssr: false }
);
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);
const RevenueChart = dynamic(
  () => import("@/components/dashboard/RevenueChart"),
  {
    ssr: false,
    loading: () => (
      <div className="card p-5 h-[280px] flex items-center justify-center">
        <PetraLoader variant="inline" />
      </div>
    ),
  }
);


// ─── Sub-components ──────────────────────────────────────────────────────────

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { subscriptionActive, subscriptionExpired, subscriptionDaysLeft, hasRecurring, isFree, isGroomer } = usePlan();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [intakeCopied, setIntakeCopied] = useState(false);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [serviceFilter, setServiceFilter] = useState("all");

  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

  // Empty string = today. Any other value shifts the whole dashboard to that day,
  // so the user can look at what is coming instead of only at today.
  const [dashDate, setDashDate] = useState("");
  const realTodayYmd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const viewedYmd = dashDate || realTodayYmd;
  const viewedLabel = new Date(`${viewedYmd}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const shiftDash = (days: number) => {
    const d = new Date(`${viewedYmd}T00:00:00`);
    d.setDate(d.getDate() + days);
    const ymd = d.toLocaleDateString("en-CA");
    setDashDate(ymd === realTodayYmd ? "" : ymd);
  };

  const { data, isLoading, isFetching: isDashFetching } = useQuery<DashboardStats>({
    queryKey: ["dashboard", dashDate],
    queryFn: () => fetchJSON(`/api/dashboard${dashDate ? `?date=${dashDate}` : ""}`),
  });

  // Per-member layout (hidden + order). A failed load falls back to the defaults.
  const { data: prefsData, isLoading: prefsLoading } = useQuery<DashboardPrefsResponse>({
    queryKey: DASHBOARD_PREFS_QUERY_KEY,
    queryFn: () => fetchJSON("/api/dashboard/preferences"),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["dashboard-activity"],
    queryFn: () => fetchJSON("/api/dashboard/activity"),
    refetchInterval: 60000,
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      fetchJSON(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const handleCopyIntakeForm = useCallback(async () => {
    setIntakeLoading(true);
    try {
      const res = await fetch("/api/intake/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.url) {
        await copyToClipboard(data.url);
        setIntakeCopied(true);
        setTimeout(() => setIntakeCopied(false), 3000);
        toast.success("קישור טופס הקליטה הועתק ללוח!", { description: data.url });
      }
    } catch {
      toast.error("שגיאה ביצירת קישור טופס הרישום");
    } finally {
      setIntakeLoading(false);
    }
  }, []);

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      completeTaskMutation.mutate(taskId);
    },
    [completeTaskMutation]
  );

  const handleCompleteOpenTask = useCallback(
    (taskId: string) => {
      setCompletingTaskIds((prev) => new Set(prev).add(taskId));
      setTimeout(() => {
        completeTaskMutation.mutate(taskId);
      }, 350);
    },
    [completeTaskMutation]
  );

  if (isLoading || prefsLoading) {
    return (
      <>
        <PageTitle title="לוח בקרה" />
        <PetraLoader />
      </>
    );
  }
  if (!data) return null;

  const filteredAppointments =
    serviceFilter === "all"
      ? data.upcomingAppointments
      : data.upcomingAppointments.filter((a) => {
          // Price-list path: check category → filter key mapping
          if (a.priceListItem?.category && CATEGORY_TO_FILTER[a.priceListItem.category] === serviceFilter) return true;
          // Legacy service path: check service.type directly
          if (a.service?.type === serviceFilter) return true;
          return false;
        });

  const widgetFlags: RequirementFlags = {
    finance: perms.canSeeFinance,
    revenue: perms.canSeeRevenueSummary,
    leads: !perms.isStaff,
    activity: !perms.isStaff && !perms.isVolunteer,
  };
  const dashPrefs = prefsData?.prefs ?? defaultDashboardPrefs(null);
  const layoutBlocks = computeLayout(visibleBlocks(dashPrefs, widgetFlags));
  const shownStats = visibleStats(dashPrefs, widgetFlags);

  // Each dashboard block, keyed by its id in src/lib/dashboard-widgets.ts.
  // Layout (order + hidden) comes from the member's saved preferences.
  const kpis: { id: string; label: string; value: string | number; sub?: string; subClass?: string; href: string }[] = [];
  if (shownStats.has("stat_revenue") && perms.canSeeRevenueSummary) {
    kpis.push({
      id: "stat_revenue",
      label: "הכנסות החודש",
      value: formatCurrency(data.monthRevenue),
      sub: (data.todayRevenue ?? 0) > 0 ? `היום: ${formatCurrency(data.todayRevenue)}` : undefined,
      href: "/payments?status=paid&period=month",
    });
  }
  if (shownStats.has("stat_active_orders") && perms.canSeeFinance) {
    kpis.push({ id: "stat_active_orders", label: "הזמנות פעילות", value: data.activeOrders, href: "/orders?status=active" });
  }
  if (shownStats.has("stat_pending_payments") && perms.canSeeFinance) {
    kpis.push({
      id: "stat_pending_payments",
      label: "הזמנות לתשלום",
      value: data.pendingPayments,
      sub: perms.canSeeRevenueSummary && data.pendingPaymentsAmount > 0 ? formatCurrency(data.pendingPaymentsAmount) : undefined,
      href: "/orders?status=confirmed&payment=unpaid",
    });
  }
  if (shownStats.has("stat_today_appointments")) {
    kpis.push({ id: "stat_today_appointments", label: "תורים היום", value: data.todayAppointments, href: `/calendar?date=${viewedYmd}` });
  }
  if (shownStats.has("stat_open_leads") && !perms.isStaff) {
    kpis.push({ id: "stat_open_leads", label: "לידים פתוחים", value: data.openLeads, href: "/leads" });
  }
  if (shownStats.has("stat_pending_bookings") && (data.pendingBookings ?? 0) > 0) {
    kpis.push({
      id: "stat_pending_bookings",
      label: "תורים ממתינים לאישור",
      value: data.pendingBookings ?? 0,
      sub: "דורש אישור",
      subClass: "text-red-700",
      href: "/bookings",
    });
  }

  const boardingGroups = [
    {
      title: "כניסות",
      items: data.todayArrivals ?? [],
      message: (s: DashboardStats["todayArrivals"][0]) => `שלום ${s.customer?.name ?? ""}! מזכירים לך שהיום הגעה של ${s.pet?.name ?? ""} לפנסיון 🐾`,
    },
    {
      title: "יציאות",
      items: data.todayDepartures ?? [],
      message: (s: DashboardStats["todayArrivals"][0]) => `שלום ${s.customer?.name ?? ""}! כלב שלך ${s.pet?.name ?? ""} מחכה לפיקאפ היום מהפנסיון 🐾`,
    },
  ].filter((g) => g.items.length > 0);

  const renderBlock = (id: DashboardBlockId): React.ReactNode => {
    switch (id) {
      case "daily_focus":
        return (
          <DailyFocusSection
            todayTasks={data.todayTasks || []}
            overdueTasks={data.overdueTasks || []}
            onComplete={handleCompleteTask}
          />
        );
      case "followups_today":
        return !perms.isStaff ? <TodayFollowUpsWidget leads={data.urgentLeads || []} /> : null;
      case "overdue_leads":
        return !perms.isStaff ? <UrgentLeadsAlert leads={data.urgentLeads || []} /> : null;
      case "top_debtors":
        return perms.canSeeFinance ? <TopDebtorsWidget debtors={data.topDebtors || []} /> : null;
      case "stats":
        if (kpis.length === 0) return null;
        return (
          <DashCard flush className="!bg-slate-100 overflow-hidden">
            <div
              className={cn(
                "grid gap-px [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]",
                // On phones (2 columns) an odd last card spans the row instead of leaving a grey hole
                "max-sm:grid-cols-2 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2"
              )}
            >
              {kpis.map((k) => (
                <Link
                  key={k.id}
                  href={k.href}
                  data-stat={k.id}
                  className="px-5 py-[18px] flex flex-col gap-1.5 bg-white text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[13px] text-slate-500">{k.label}</span>
                  <span className="text-[26px] font-bold tracking-[-0.02em] leading-[1.1] tabular-nums">{k.value}</span>
                  <span className={cn("text-xs min-h-4", k.subClass ?? "text-slate-500")}>{k.sub ?? ""}</span>
                </Link>
              ))}
            </div>
          </DashCard>
        );
      case "boarding_today":
        if (boardingGroups.length === 0) return null;
        return (
          <DashCard>
            <DashCardHeader title="פנסיון היום" actions={<DashLink href="/boarding">לפנסיון</DashLink>} />
            <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-8">
              {boardingGroups.map((g) => (
                <div key={g.title}>
                  <span className="block text-xs font-semibold text-slate-500 pb-1">{g.title}</span>
                  {g.items.map((s) => (
                    <DashRow key={s.id}>
                      <Link
                        href={s.customer?.id ? `/customers/${s.customer.id}` : "/boarding"}
                        className="flex-1 flex flex-col gap-0.5 min-w-0 text-slate-900 hover:text-orange-600"
                      >
                        <span className="text-sm font-medium truncate">{s.pet?.name ?? ""}</span>
                        <span className="text-xs text-slate-500 truncate">
                          {s.customer?.name ?? ""}
                          {s.room ? ` · ${s.room.name}` : ""}
                        </span>
                      </Link>
                      {s.customer?.phone && (
                        <WaIconButton
                          href={`https://wa.me/${toWhatsAppPhone(s.customer.phone)}?text=${encodeURIComponent(g.message(s))}`}
                        />
                      )}
                    </DashRow>
                  ))}
                </div>
              ))}
            </div>
          </DashCard>
        );
      case "revenue_chart":
        return perms.canSeeRevenueSummary ? (
          <RevenueChart
            data={data.revenueByMonth}
            target={data.revenueTarget}
            topService={data.topService}
            reportsHref={perms.canViewAnalytics ? "/analytics" : undefined}
          />
        ) : null;
      case "upcoming_appointments":
        return (
          <DashCard>
            <DashCardHeader
              title="תורים קרובים"
              actions={<DashLink href={`/calendar?date=${viewedYmd}`}>הצג הכל</DashLink>}
            />
            <div className="pb-2.5">
              <Segmented
                options={SERVICE_TYPE_TABS.filter((tab) => !(isGroomer && (tab.key === "training" || tab.key === "boarding"))).map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                }))}
                value={serviceFilter}
                onChange={setServiceFilter}
              />
            </div>
            {filteredAppointments.length === 0 ? (
              <DashEmpty>אין תורים קרובים</DashEmpty>
            ) : (
              filteredAppointments.map((apt) => <AppointmentRow key={apt.id} appointment={apt} />)
            )}
          </DashCard>
        );
      case "recent_orders":
        return (
          <DashCard>
            <DashCardHeader title="הזמנות אחרונות" actions={<DashLink href="/orders">הצג הכל</DashLink>} />
            {data.recentOrders.length === 0 ? (
              <DashEmpty>אין הזמנות</DashEmpty>
            ) : (
              data.recentOrders.map((order) => {
                const typeInfo = ORDER_TYPE_INFO[order.orderType] || ORDER_TYPE_INFO.sale;
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-center py-[11px] px-2 -mx-2 border-t border-slate-100 rounded-lg text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium truncate">{order.customerName}</span>
                      <span className="text-xs text-slate-500">{typeInfo.label}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: ORDER_STATUS_COLOR[order.status] ?? "#64748B" }}>
                      {ORDER_STATUS_LABEL[order.status] || order.status}
                    </span>
                    <span className="text-sm font-semibold min-w-[72px] text-left tabular-nums">{formatCurrency(order.total)}</span>
                  </Link>
                );
              })
            )}
          </DashCard>
        );
      case "activity_feed":
        return !perms.isStaff && !perms.isVolunteer ? (
          <DashCard>
            <DashCardHeader title="פעילות אחרונה" actions={<span className="text-[13px] text-slate-500">24 שעות אחרונות</span>} />
            <ActivityFeed activities={activityData?.activities || []} />
          </DashCard>
        ) : null;
      case "tomorrow_reminders":
        return <TomorrowReminders appointments={data.tomorrowAppointments ?? []} />;
      case "vaccinations":
        return <VaccinationAlertWidget />;
      case "medications":
        return <MedicationsWidget />;
      case "birthdays":
        return <PetBirthdaysWidget birthdays={data.upcomingBirthdays ?? []} />;
      case "at_risk":
        return <AtRiskCustomersWidget customers={data.atRiskCustomers ?? []} />;
      case "open_tasks":
        return (
          <DashCard>
            <DashCardHeader title="משימות פתוחות" actions={<DashLink href="/tasks">הצג הכל</DashLink>} />
            {data.recentTasks.length === 0 ? (
              <DashEmpty>אין משימות פתוחות</DashEmpty>
            ) : (
              data.recentTasks.map((task) => {
                const isCompleting = completingTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 py-[11px] border-t border-slate-100 transition-all duration-300",
                      isCompleting && "opacity-0 max-h-0 py-0 overflow-hidden"
                    )}
                  >
                    <TaskCheckbox onClick={() => handleCompleteOpenTask(task.id)} completing={isCompleting} />
                    <PriorityDot priority={task.priority} />
                    <Link
                      href={`/tasks?task=${task.id}`}
                      className={cn(
                        "flex-1 min-w-0 truncate text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors",
                        isCompleting && "line-through text-slate-400"
                      )}
                    >
                      {task.title}
                    </Link>
                    <span className="text-xs text-slate-500 flex-shrink-0">{TASK_CATEGORY_LABELS[task.category] ?? task.category}</span>
                  </div>
                );
              })
            )}
          </DashCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription Banner */}
      {subscriptionExpired && !isFree && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4 bg-red-50 border border-red-100 text-red-700 text-sm">
          <span className="font-medium">המנוי שלך פג — הגישה לתכונות מתקדמות הוגבלה</span>
          <Link href="/upgrade" className="font-semibold underline shrink-0">חדש מנוי</Link>
        </div>
      )}
      {/* Recurring (הוראת קבע) customers renew automatically — a manual renew would charge twice */}
      {!isFree && !hasRecurring && subscriptionActive && subscriptionDaysLeft <= 14 && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4 bg-amber-50 border border-amber-100 text-amber-700 text-sm">
          <span className="font-medium">המנוי שלך מסתיים בעוד {subscriptionDaysLeft} ימים</span>
          <Link href="/upgrade" className="font-semibold underline shrink-0">חדש מנוי</Link>
        </div>
      )}
      {/* Greeting Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] leading-tight text-slate-900">
              שלום, {user?.name || "משתמש"}
            </h1>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
              }}
              title="רענן נתונים"
              aria-label="רענן נתונים"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={cn("w-[15px] h-[15px]", isDashFetching && "animate-spin")} />
            </button>
            {data.totalCustomers > 0 && (
              <button
                onClick={() => setShowCustomize(true)}
                title="התאמת הדשבורד — מה יוצג ובאיזה סדר"
                aria-label="התאמת הדשבורד"
                className="h-7 px-2 flex items-center gap-1.5 rounded-lg text-[13px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <SlidersHorizontal className="w-[15px] h-[15px]" />
                <span className="hidden sm:inline">התאמת הדשבורד</span>
              </button>
            )}
          </div>
          {/* Date navigation — the cards below follow the selected day; the label opens a date picker */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftDash(-1)}
              title="יום אחורה"
              aria-label="יום אחורה"
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const el = dateInputRef.current;
                  if (!el) return;
                  try {
                    el.showPicker();
                  } catch {
                    el.focus();
                  }
                }}
                title="הצג את לוח הבקרה לתאריך אחר"
                className="text-sm text-slate-700 px-2 min-w-[190px] text-center tabular-nums rounded-lg hover:bg-slate-100 h-7"
              >
                {viewedLabel}
              </button>
              <input
                ref={dateInputRef}
                type="date"
                lang="he"
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 opacity-0 pointer-events-none"
                value={viewedYmd}
                onChange={(e) => setDashDate(e.target.value && e.target.value !== realTodayYmd ? e.target.value : "")}
              />
            </div>
            <button
              type="button"
              onClick={() => shiftDash(1)}
              title="יום קדימה"
              aria-label="יום קדימה"
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {dashDate && (
              <button
                type="button"
                onClick={() => setDashDate("")}
                className="h-7 px-2.5 ms-1 rounded-lg bg-orange-50 text-orange-700 text-[13px] font-medium hover:bg-orange-100"
              >
                היום
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
          <button
            onClick={() => setShowNewCustomer(true)}
            className="h-10 px-4 rounded-xl bg-gradient-brand text-white text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shadow-sm hover:brightness-105 hover:shadow-[0_4px_12px_-2px_rgba(249,115,22,0.35)] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4 shrink-0" />
            לקוח חדש
          </button>
          <Link
            href="/calendar?new=1"
            className="h-10 px-4 rounded-xl bg-white border border-orange-500 text-orange-600 text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap hover:bg-orange-50 active:scale-[0.98] transition-all"
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            קביעת תור
          </Link>
          <button
            onClick={() => setShowNewOrder(true)}
            className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            הזמנה חדשה
          </button>
          <button
            onClick={handleCopyIntakeForm}
            disabled={intakeLoading}
            className={cn(
              "h-10 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] transition-all disabled:opacity-60",
              intakeCopied
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
            )}
            title="יצירת טופס קליטה והעתקת קישור"
          >
            {intakeCopied ? <ClipboardCheck className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {intakeCopied ? "הועתק!" : "טופס קליטה"}
          </button>
          {user?.businessSlug && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/book/${user.businessSlug}`;
                copyToClipboard(url)
                  .then(() => toast.success("קישור הזמנת תורים הועתק!", { description: url }))
                  .catch(() => toast.info("הקישור לקוחות שלך:", { description: url, duration: 10000 }));
              }}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all"
              title="העתק קישור הזמנת תורים אונליין"
            >
              <Copy className="w-4 h-4 shrink-0" />
              תורים אונליין
            </button>
          )}
        </div>
      </div>

      {/* Setup Checklist — shown to users who haven't completed setup yet */}
      <SetupChecklist />

      {/* Welcome modal — shown once to new team members (non-owners) */}
      <TeamWelcomeModal />

      {/* Onboarding Wizard modal */}
      {showOnboardingWizard && (
        <OnboardingWizardModal onClose={() => setShowOnboardingWizard(false)} />
      )}

      {data.totalCustomers === 0 ? (
        /* ── New Business Welcome Section ── */
        <div className="space-y-6">
          <div
            className="card p-8 text-center animate-slide-up"
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(59,130,246,0.04) 100%)",
              borderColor: "rgba(249,115,22,0.15)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{ background: "linear-gradient(135deg, #F97316, #FB923C)" }}
            >
              🐾
            </div>
            <h2 className="text-xl font-bold text-petra-text mb-2">ברוכים הבאים ל-Petra!</h2>
            <p className="text-sm text-petra-muted max-w-md mx-auto">
              המערכת מוכנה — בואו נתחיל לבנות את העסק שלכם. הנה כמה צעדים ראשונים:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => setShowNewCustomer(true)}
              className="card p-5 text-right hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-petra-text mb-1">הוסף לקוח ראשון</h3>
              <p className="text-xs text-petra-muted leading-relaxed">הכנס את פרטי הלקוח הראשון שלך למערכת</p>
            </button>

            <Link
              href="/calendar?new=1"
              className="card p-5 text-right hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
                <CalendarClock className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="text-sm font-bold text-petra-text mb-1">קבע תור ראשון</h3>
              <p className="text-xs text-petra-muted leading-relaxed">תזמן פגישה ראשונה עם לקוח</p>
            </Link>

            <Link
              href="/pricing"
              className="card p-5 text-right hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                <Tag className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-petra-text mb-1">הגדר שירותים ומחירון</h3>
              <p className="text-xs text-petra-muted leading-relaxed">הוסף את השירותים שהעסק שלך מציע</p>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleCopyIntakeForm}
              disabled={intakeLoading}
              className={cn(
                "card p-4 flex items-center gap-3 hover:border-brand-300 transition-all text-right",
                intakeCopied && "border-green-300 bg-green-50/50"
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                {intakeCopied ? <ClipboardCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-orange-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-petra-text">{intakeCopied ? "הועתק!" : "טופס קליטה"}</p>
                <p className="text-xs text-petra-muted">העתק קישור לטופס קליטה ושלח ללקוח</p>
              </div>
            </button>

            {user?.businessSlug && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/book/${user.businessSlug}`;
                  copyToClipboard(url).then(() => {
                    toast.success("קישור הזמנת תורים הועתק!", { description: url });
                  }).catch(() => toast.error("לא הצלחנו להעתיק"));
                }}
                className="card p-4 flex items-center gap-3 hover:border-brand-300 transition-all text-right"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Copy className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">תורים אונליין</p>
                  <p className="text-xs text-petra-muted">העתק קישור לדף ההזמנה לאתר שלך</p>
                </div>
              </button>
            )}
          </div>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {layoutBlocks.map((b) => (
          <div
            key={b.id}
            data-dashboard-block={b.id}
            className={cn("min-w-0 empty:hidden", b.wide && "lg:col-span-2")}
          >
            {renderBlock(b.id)}
          </div>
        ))}
      </div>
      </>
      )}

      {showCustomize && (
        <DashboardCustomizeModal
          prefs={dashPrefs}
          flags={widgetFlags}
          onClose={() => setShowCustomize(false)}
        />
      )}

      {/* New Customer Modal */}
      <NewCustomerModal
        isOpen={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={() => {
          setShowNewCustomer(false);
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />

      {/* New Appointment Modal */}
      <NewAppointmentModal
        isOpen={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        onCreated={() => {
          setShowNewAppointment(false);
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />

      {/* New Order Modal */}
      <CreateOrderModal
        isOpen={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onCreated={() => {
          setShowNewOrder(false);
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />
    </div>
  );
}
