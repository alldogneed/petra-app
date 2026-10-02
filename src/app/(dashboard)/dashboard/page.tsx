"use client";
import { PageTitle } from "@/components/ui/PageTitle";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, CheckCircle2, Target, CreditCard, ArrowLeft, Plus, ShoppingCart, LogIn, UserPlus, MessageCircle, Hotel, CalendarClock, Check, TrendingUp, Copy, ClipboardCheck, RefreshCw, Tag, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, fetchJSON, cn, toWhatsAppPhone, copyToClipboard } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { defaultDashboardPrefs, layoutBlocks as computeLayout, visibleBlocks, visibleStats, DASHBOARD_PREFS_QUERY_KEY, type DashboardBlockId, type DashboardPrefsResponse, type RequirementFlags } from "@/lib/dashboard-widgets";
import { TASK_CATEGORY_LABELS, DashboardStats, ActivityItem, SERVICE_TYPE_TABS, CATEGORY_TO_FILTER, ORDER_TYPE_INFO, ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/components/dashboard/dashboard-shared";
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

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div className="stat-card group p-5">
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `${color}1A` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        {href && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-brand-50 group-hover:border-brand-200 group-hover:text-brand-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-4 sm:mt-5 leading-tight">
        <div className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-petra-text tracking-tight leading-none">{value}</div>
        <div className="mt-1.5 sm:mt-2 text-[13px] sm:text-sm font-semibold text-petra-text">{title}</div>
        {subtitle && <div className="mt-1 text-[12px] text-petra-muted">{subtitle}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card-hover block">
        {content}
      </Link>
    );
  }
  return <div className="card-hover">{content}</div>;
}

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

  const todayStr = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });

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
  const renderBlock = (id: DashboardBlockId): React.ReactNode => {
    switch (id) {
      case "daily_focus":
        return (
          <>
          <DailyFocusSection
            todayTasks={data.todayTasks || []}
            overdueTasks={data.overdueTasks || []}
            onComplete={handleCompleteTask}
          />
          </>
        );
      case "followups_today":
        return (
          <>
          {!perms.isStaff && <TodayFollowUpsWidget leads={data.urgentLeads || []} />}
          </>
        );
      case "overdue_leads":
        return (
          <>
          {!perms.isStaff && <UrgentLeadsAlert leads={data.urgentLeads || []} />}
          </>
        );
      case "top_debtors":
        return (
          <>
          {perms.canSeeFinance && <TopDebtorsWidget debtors={data.topDebtors || []} />}
          </>
        );
      case "stats":
        if (shownStats.size === 0) return null;
        return (
          <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-3">
            {shownStats.has("stat_revenue") && perms.canSeeRevenueSummary && (
              <StatCard
                title="הכנסות החודש"
                value={formatCurrency(data.monthRevenue)}
                subtitle={(data.todayRevenue ?? 0) > 0 ? `היום: ${formatCurrency(data.todayRevenue)}` : undefined}
                icon={TrendingUp}
                color="#10B981"
                href="/payments?status=paid&period=month"
              />
            )}
            {shownStats.has("stat_active_orders") && perms.canSeeFinance && (
              <StatCard
                title="הזמנות פעילות"
                value={data.activeOrders}
                icon={ShoppingCart}
                color="#F97316"
                href="/orders?status=active"
              />
            )}
            {shownStats.has("stat_pending_payments") && perms.canSeeFinance && (
              <StatCard
                title="הזמנות לתשלום"
                value={data.pendingPayments}
                subtitle={perms.canSeeRevenueSummary && data.pendingPaymentsAmount > 0 ? formatCurrency(data.pendingPaymentsAmount) : undefined}
                icon={CreditCard}
                color="#F59E0B"
                href="/orders?status=confirmed&payment=unpaid"
              />
            )}
            {shownStats.has("stat_today_appointments") && (
              <StatCard
                title="תורים היום"
                value={data.todayAppointments}
                icon={Calendar}
                color="#3B82F6"
                href={`/calendar?date=${viewedYmd}`}
              />
            )}
            {shownStats.has("stat_open_leads") && !perms.isStaff && (
              <StatCard
                title="לידים פתוחים"
                value={data.openLeads}
                icon={Target}
                color="#8B5CF6"
                href="/leads"
              />
            )}
            {shownStats.has("stat_pending_bookings") && (data.pendingBookings ?? 0) > 0 && (
              <StatCard
                title="תורים ממתינים לאישור"
                value={data.pendingBookings ?? 0}
                icon={CalendarClock}
                color="#EF4444"
                href="/bookings"
              />
            )}
          </div>
          </>
        );
      case "boarding_today":
        return (
          <>
          {((data.todayArrivals?.length ?? 0) > 0 || (data.todayDepartures?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(data.todayArrivals?.length ?? 0) > 0 && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <LogIn className="w-4 h-4 text-emerald-600" />
                    </div>
                    <Link href="/boarding" className="text-sm font-semibold text-petra-text hover:text-brand-600">כניסות היום לפנסיון</Link>
                    <span className="badge-success text-[10px] ms-auto">{data.todayArrivals.length}</span>
                  </div>
                  <div className="space-y-2">
                    {data.todayArrivals.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                          {s.pet?.name?.charAt(0) ?? "🐾"}
                        </div>
                        <Link
                          href={s.customer?.id ? `/customers/${s.customer.id}` : "/boarding"}
                          className="min-w-0 flex-1 hover:text-brand-600"
                        >
                          <p className="text-xs font-medium text-petra-text truncate">{s.pet?.name ?? ""}</p>
                          <p className="text-[10px] text-petra-muted truncate">{s.customer?.name}{s.room ? ` · ${s.room.name}` : ""}</p>
                        </Link>
                        <a
                          href={`https://wa.me/${toWhatsAppPhone(s.customer?.phone ?? "")}?text=${encodeURIComponent(`שלום ${s.customer?.name}! מזכירים לך שהיום הגעה של ${s.pet?.name} לפנסיון 🐾`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(data.todayDepartures?.length ?? 0) > 0 && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Hotel className="w-4 h-4 text-amber-600" />
                    </div>
                    <Link href="/boarding" className="text-sm font-semibold text-petra-text hover:text-brand-600">יציאות היום מהפנסיון</Link>
                    <span className="badge-warning text-[10px] ms-auto">{data.todayDepartures.length}</span>
                  </div>
                  <div className="space-y-2">
                    {data.todayDepartures.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                          {s.pet?.name?.charAt(0) ?? "🐾"}
                        </div>
                        <Link
                          href={s.customer?.id ? `/customers/${s.customer.id}` : "/boarding"}
                          className="min-w-0 flex-1 hover:text-brand-600"
                        >
                          <p className="text-xs font-medium text-petra-text truncate">{s.pet?.name ?? ""}</p>
                          <p className="text-[10px] text-petra-muted truncate">{s.customer?.name}{s.room ? ` · ${s.room.name}` : ""}</p>
                        </Link>
                        <a
                          href={`https://wa.me/${toWhatsAppPhone(s.customer?.phone ?? "")}?text=${encodeURIComponent(`שלום ${s.customer?.name}! כלב שלך ${s.pet?.name} מחכה לפיקאפ היום מהפנסיון 🐾`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </>
        );
      case "revenue_chart":
        return (
          <>
          {perms.canSeeRevenueSummary && (
            <RevenueChart
              data={data.revenueByMonth}
              target={data.revenueTarget}
              topService={data.topService}
              reportsHref={perms.canViewAnalytics ? "/analytics" : undefined}
            />
          )}
          </>
        );
      case "upcoming_appointments":
        return (
          <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-petra-text">תורים קרובים</h2>
              <Link
                href={`/calendar?date=${viewedYmd}`}
                className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
              >
                הצג הכל
                <ArrowLeft className="w-3 h-3" />
              </Link>
            </div>

            {/* Service type tabs */}
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {SERVICE_TYPE_TABS.filter((tab) => !(isGroomer && (tab.key === "training" || tab.key === "boarding"))).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setServiceFilter(tab.key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                    serviceFilter === tab.key
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-petra-muted hover:bg-slate-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <Calendar className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-petra-muted">אין תורים קרובים</p>
              </div>
            ) : (
              <div>
                {filteredAppointments.map((apt) => (
                  <AppointmentRow key={apt.id} appointment={apt} />
                ))}
              </div>
            )}
          </div>
          </>
        );
      case "recent_orders":
        return (
          <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">הזמנות אחרונות</h2>
              <Link href="/orders" className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1">
                הצג הכל
                <ArrowLeft className="w-3 h-3" />
              </Link>
            </div>

            {data.recentOrders.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <ShoppingCart className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-petra-muted">אין הזמנות</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.recentOrders.map((order) => {
                  const typeInfo = ORDER_TYPE_INFO[order.orderType] || ORDER_TYPE_INFO.sale;
                  const TypeIcon = typeInfo.icon;
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center gap-3 py-2.5 px-1 hover:bg-slate-50/50 rounded-lg transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-50">
                        <TypeIcon className="w-4 h-4 text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-petra-text truncate">
                            {order.customerName}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                              ORDER_STATUS_BADGE[order.status] || "badge-neutral"
                            )}
                          >
                            {ORDER_STATUS_LABEL[order.status] || order.status}
                          </span>
                        </div>
                        <div className="text-xs text-petra-muted mt-0.5">
                          {typeInfo.label}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-petra-text">
                          {formatCurrency(order.total)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          </>
        );
      case "activity_feed":
        return (
          <>
          {!perms.isStaff && !perms.isVolunteer && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text">פעילות אחרונה</h2>
                <span className="text-[11px] text-petra-muted">24 שעות אחרונות</span>
              </div>
              <ActivityFeed activities={activityData?.activities || []} />
            </div>
          )}
          </>
        );
      case "tomorrow_reminders":
        return (
          <>
          <TomorrowReminders appointments={data.tomorrowAppointments ?? []} />
          </>
        );
      case "vaccinations":
        return (
          <>
          <VaccinationAlertWidget />
          </>
        );
      case "medications":
        return (
          <>
          <MedicationsWidget />
          </>
        );
      case "birthdays":
        return (
          <>
          <PetBirthdaysWidget birthdays={data.upcomingBirthdays ?? []} />
          </>
        );
      case "at_risk":
        return (
          <>
          <AtRiskCustomersWidget customers={data.atRiskCustomers ?? []} />
          </>
        );
      case "open_tasks":
        return (
          <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">משימות פתוחות</h2>
              <Link
                href="/tasks"
                className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
              >
                הצג הכל
                <ArrowLeft className="w-3 h-3" />
              </Link>
            </div>

            {data.recentTasks.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <CheckCircle2 className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-petra-muted">אין משימות פתוחות</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentTasks.map((task) => {
                  const isCompleting = completingTaskIds.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all duration-300",
                        isCompleting && "opacity-0 max-h-0 p-0 overflow-hidden"
                      )}
                    >
                      <button
                        onClick={() => handleCompleteOpenTask(task.id)}
                        disabled={isCompleting}
                        className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                          isCompleting
                            ? "bg-green-500 border-green-500"
                            : "border-slate-300 hover:border-green-500 hover:bg-green-50"
                        )}
                        title="סמן כבוצע"
                      >
                        {isCompleting && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background:
                            task.priority === "URGENT"
                              ? "#DC2626"
                              : task.priority === "HIGH"
                                ? "#EF4444"
                                : task.priority === "MEDIUM"
                                  ? "#F59E0B"
                                  : "#94A3B8",
                        }}
                      />
                      <Link
                        href={`/tasks?task=${task.id}`}
                        className={cn(
                          "text-sm text-petra-text flex-1 truncate transition-all duration-200 hover:text-brand-600",
                          isCompleting && "line-through text-petra-muted"
                        )}
                      >
                        {task.title}
                      </Link>
                      <span className="badge-neutral text-[10px]">{TASK_CATEGORY_LABELS[task.category] ?? task.category}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription Banner */}
      {subscriptionExpired && !isFree && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between bg-red-50 border border-red-200 text-red-800">
          <span className="text-sm font-medium">⚠️ המנוי שלך פג — הגישה לתכונות מתקדמות הוגבלה</span>
          <Link href="/upgrade" className="text-sm font-semibold underline shrink-0 mr-4">חדש מנוי</Link>
        </div>
      )}
      {/* Recurring (הוראת קבע) customers renew automatically — a manual renew would charge twice */}
      {!isFree && !hasRecurring && subscriptionActive && subscriptionDaysLeft <= 14 && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800">
          <span className="text-sm font-medium">⏳ המנוי שלך מסתיים בעוד {subscriptionDaysLeft} ימים</span>
          <Link href="/upgrade" className="text-sm font-semibold underline shrink-0 mr-4">חדש מנוי</Link>
        </div>
      )}
      {/* Greeting Header */}
      <div className="space-y-3 mb-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-petra-text">
              שלום, {user?.name || "משתמש"} 👋
            </h1>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
              }}
              title="רענן נתונים"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDashFetching ? "animate-spin" : ""}`} />
            </button>
            {data.totalCustomers > 0 && (
              <button
                onClick={() => setShowCustomize(true)}
                title="התאמת הדשבורד — מה יוצג ובאיזה סדר"
                className="h-7 px-2 flex items-center gap-1 rounded-lg text-xs text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">התאמת הדשבורד</span>
              </button>
            )}
          </div>
          <p className="text-sm text-petra-muted">{todayStr}</p>
          {/* Date navigation — the cards below follow the selected day */}
          <div className="flex items-center gap-1 mt-1">
            <button
              type="button"
              onClick={() => shiftDash(-1)}
              title="יום אחורה"
              className="w-7 h-7 rounded-lg border border-petra-border text-petra-muted hover:bg-slate-50"
            >
              ‹
            </button>
            <input
              type="date"
              lang="he"
              className="input !py-1 !px-2 text-xs w-[8.5rem]"
              value={viewedYmd}
              onChange={(e) => setDashDate(e.target.value && e.target.value !== realTodayYmd ? e.target.value : "")}
              title="הצג את לוח הבקרה לתאריך אחר"
            />
            <button
              type="button"
              onClick={() => shiftDash(1)}
              title="יום קדימה"
              className="w-7 h-7 rounded-lg border border-petra-border text-petra-muted hover:bg-slate-50"
            >
              ›
            </button>
            {dashDate && (
              <button
                type="button"
                onClick={() => setDashDate("")}
                className="h-7 px-2 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium hover:bg-orange-100"
              >
                היום
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-row gap-2">
          <button
            onClick={() => setShowNewCustomer(true)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 shrink-0" />
            לקוח חדש
          </button>
          <Link
            href="/calendar?new=1"
            className="btn-secondary flex items-center justify-center gap-2 border-brand-500 text-brand-600 hover:bg-brand-50"
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            קביעת תור
          </Link>
          <button
            onClick={() => setShowNewOrder(true)}
            className="btn-secondary flex items-center justify-center gap-2 text-slate-500 border-slate-200"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            הזמנה חדשה
          </button>
          <button
            onClick={handleCopyIntakeForm}
            disabled={intakeLoading}
            className={cn(
              "btn-secondary flex items-center justify-center gap-2 text-slate-500 border-slate-200 transition-colors",
              intakeCopied && "bg-green-50 text-green-700 border-green-300"
            )}
            title="יצירת טופס קליטה והעתקת קישור"
          >
            {intakeCopied ? (
              <>
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                הועתק!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>טופס קליטה</span>
              </>
            )}
          </button>
          {user?.businessSlug && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/book/${user.businessSlug}`;
                copyToClipboard(url)
                  .then(() => toast.success("קישור הזמנת תורים הועתק!", { description: url }))
                  .catch(() => toast.info("הקישור לקוחות שלך:", { description: url, duration: 10000 }));
              }}
              className="btn-secondary flex items-center justify-center gap-2 text-slate-500 border-slate-200"
              title="העתק קישור הזמנת תורים אונליין"
            >
              <Copy className="w-4 h-4 shrink-0" />
              <span>תורים אונליין</span>
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
