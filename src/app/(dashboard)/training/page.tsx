"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  GraduationCap,
  Plus,
  X,
  Users,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Dog,
  Search,
  Hotel,
  CheckCircle2,
  Send,
  Trash2,
  Package,
  AlertTriangle,
  Settings,
  BookOpen,
  Circle,
} from "lucide-react";
import { cn, formatDate, formatCurrency, toWhatsAppPhone, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import {
  GROUP_TYPE_LABELS,
  GROUP_TYPE_COLORS,
} from "@/lib/training-groups";
import {
  PROGRAM_TYPE_COLORS,
} from "@/lib/training-programs";

// ─── Types ───────────────────────────────────────────

interface TrainingGroup {
  id: string;
  name: string;
  groupType: string;
  location: string | null;
  defaultDayOfWeek: number | null;
  defaultTime: string | null;
  maxParticipants: number | null;
  notes: string | null;
  isActive: boolean;
  participants: Participant[];
  sessions: GroupSession[];
  _count: { participants: number; sessions: number };
}

interface Participant {
  id: string;
  status: string;
  dog: { id: string; name: string; breed: string | null };
  customer: { id: string; name: string; phone: string };
}

interface GroupSession {
  id: string;
  sessionNumber: number | null;
  sessionDatetime: string;
  status: string;
  notes: string | null;
  attendance: { id: string; attendanceStatus: string; participantId: string; participant?: { dog: { name: string }; customer: { name: string } } }[];
}

interface TrainingProgram {
  id: string;
  name: string;
  programType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  totalSessions: number | null;
  location: string | null;
  frequency: string | null;
  price: number | null;
  notes: string | null;
  dog: { id: string; name: string; breed: string | null };
  customer: { id: string; name: string; phone: string };
  goals: { id: string; title: string; status: string; progressPercent: number }[];
  sessions: ProgramSession[];
  homework: { id: string; title: string; isCompleted: boolean }[];
  _count: { goals: number; sessions: number; homework: number };
}

interface ProgramSession {
  id: string;
  sessionNumber: number | null;
  sessionDate: string;
  durationMinutes: number;
  status: string;
  summary: string | null;
  rating: number | null;
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  notes: string | null;
  pet: { id: string; name: string; species: string; breed: string | null };
  customer: { id: string; name: string };
  room: { id: string; name: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string; species: string }[];
}

// ─── Unified dog type for Overview ───

type TrainingType = "individual" | "boarding" | "group" | "workshop";

interface UnifiedDog {
  key: string;
  dogName: string;
  customerName: string;
  customerPhone: string;
  type: TrainingType;
  status: string;
  detail: string;
  progress?: { used: number; total: number };
  entityId: string;
}

// ─── Constants ───────────────────────────────────────

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type TabId = "overview" | "individual" | "boarding" | "groups" | "workshops";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "סקירה", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "individual", label: "אילוף בבית הלקוח", icon: <Dog className="w-4 h-4" /> },
  { id: "boarding", label: "פנסיון", icon: <Hotel className="w-4 h-4" /> },
  { id: "groups", label: "קבוצות", icon: <Users className="w-4 h-4" /> },
  { id: "workshops", label: "סדנאות", icon: <Calendar className="w-4 h-4" /> },
];

const TYPE_BADGE: Record<TrainingType, { label: string; bg: string; text: string }> = {
  individual: { label: "אילוף בבית הלקוח", bg: "bg-blue-100", text: "text-blue-700" },
  boarding: { label: "פנסיון", bg: "bg-green-100", text: "text-green-700" },
  group: { label: "קבוצה", bg: "bg-purple-100", text: "text-purple-700" },
  workshop: { label: "סדנה", bg: "bg-pink-100", text: "text-pink-700" },
};

const PROGRAM_TYPES_MAP: Record<string, string> = {
  BASIC_OBEDIENCE: "ציות בסיסי",
  REACTIVITY: "תגובתיות",
  PUPPY: "גורים",
  BEHAVIOR: "בעיות התנהגות",
  ADVANCED: "ציות מתקדם",
  CUSTOM: "מותאם אישית",
};

const GROUP_TYPES_MAP: Record<string, string> = {
  PUPPY_CLASS: "כיתת גורים",
  REACTIVITY: "תגובתיות",
  OBEDIENCE: "ציות",
  CUSTOM: "מותאם אישית",
  WORKSHOP: "סדנה",
};

const PROGRAM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "פעיל", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "הושלם", color: "bg-green-100 text-green-700" },
  PAUSED: { label: "מושהה", color: "bg-yellow-100 text-yellow-700" },
  CANCELED: { label: "בוטל", color: "bg-red-100 text-red-700" },
};

// ═══════════════════════════════════════════════════════
// SESSION LOG MODAL
// ═══════════════════════════════════════════════════════

function SessionLogModal({
  dogName,
  sessionNumber,
  isPending,
  onClose,
  onSubmit,
}: {
  dogName: string;
  sessionNumber: number;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (summary: string, sessionDate: string, rating: number | null) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [summary, setSummary] = useState("");
  const [sessionDate, setSessionDate] = useState(today);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const STAR_LABELS = ["חלש", "סביר", "טוב", "מצוין", "מושלם"];

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">
            רישום מפגש — {dogName}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700 font-medium">
            מפגש מספר {sessionNumber}
          </div>
          <div>
            <label className="label">תאריך המפגש</label>
            <input
              type="date"
              className="input"
              value={sessionDate}
              max={today}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">דירוג הכלב במפגש (אופציונלי)</label>
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating ?? rating ?? 0) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    className={cn(
                      "text-2xl transition-transform hover:scale-110",
                      active ? "text-amber-400" : "text-slate-200"
                    )}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(rating === star ? null : star)}
                  >
                    ★
                  </button>
                );
              })}
              {(hoverRating ?? rating) && (
                <span className="text-xs text-petra-muted mr-1">
                  {STAR_LABELS[(hoverRating ?? rating ?? 1) - 1]}
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="label">סיכום המפגש (אופציונלי)</label>
            <textarea
              className="input"
              rows={4}
              placeholder="תאר מה עבדתם היום, התקדמות, הוראות לתרגול בבית..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || !sessionDate}
            onClick={() => onSubmit(summary, sessionDate, rating)}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? "שומר..." : "שמור מפגש"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSellPackage, setShowSellPackage] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewWorkshop, setShowNewWorkshop] = useState(false);
  const [showAssignDog, setShowAssignDog] = useState<{ groupId: string; groupName: string } | null>(null);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sessionLogTarget, setSessionLogTarget] = useState<{ programId: string; sessionNumber: number; dogName: string } | null>(null);
  const queryClient = useQueryClient();

  // ─── Data fetching ───

  const { data: programs = [], isLoading: programsLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs"),
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery<TrainingGroup[]>({
    queryKey: ["training-groups"],
    queryFn: () => fetchJSON<TrainingGroup[]>("/api/training-groups?active=true"),
  });

  const { data: stays = [], isLoading: staysLoading } = useQuery<BoardingStay[]>({
    queryKey: ["boarding-stays"],
    queryFn: () => fetchJSON<BoardingStay[]>("/api/boarding"),
  });

  const isLoading = programsLoading || groupsLoading || staysLoading;

  // ─── Derived data ───

  const regularGroups = useMemo(() => groups.filter((g) => g.groupType !== "WORKSHOP"), [groups]);
  const workshops = useMemo(() => groups.filter((g) => g.groupType === "WORKSHOP"), [groups]);
  const activeStays = useMemo(() => {
    const now = new Date();
    return stays.filter((s) => {
      if (s.status === "checked_in") return true;
      const checkInDate = new Date(s.checkIn);
      const checkOutDate = s.checkOut ? new Date(s.checkOut) : null;
      return checkInDate <= now && (!checkOutDate || checkOutDate >= now);
    });
  }, [stays]);

  const allDogs = useMemo<UnifiedDog[]>(() => {
    const dogs: UnifiedDog[] = [];

    // Individual programs
    programs.forEach((p) => {
      const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
      dogs.push({
        key: `program-${p.id}`,
        dogName: p.dog.name,
        customerName: p.customer.name,
        customerPhone: p.customer.phone,
        type: "individual",
        status: p.status,
        detail: PROGRAM_TYPES_MAP[p.programType] || p.programType,
        progress: p.totalSessions ? { used: usedSessions, total: p.totalSessions } : undefined,
        entityId: p.id,
      });
    });

    // Boarding stays
    activeStays.forEach((s) => {
      const daysLeft = s.checkOut
        ? Math.ceil((new Date(s.checkOut).getTime() - Date.now()) / 86400000)
        : null;
      dogs.push({
        key: `boarding-${s.id}`,
        dogName: s.pet.name,
        customerName: s.customer.name,
        customerPhone: "",
        type: "boarding",
        status: "checked_in",
        detail: daysLeft !== null ? `${Math.max(0, daysLeft)} ימים נותרו` : "ללא תאריך יציאה",
        entityId: s.id,
      });
    });

    // Regular groups
    regularGroups.forEach((g) => {
      g.participants.forEach((p) => {
        dogs.push({
          key: `group-${g.id}-${p.id}`,
          dogName: p.dog.name,
          customerName: p.customer.name,
          customerPhone: p.customer.phone,
          type: "group",
          status: p.status,
          detail: g.name,
          entityId: g.id,
        });
      });
    });

    // Workshops
    workshops.forEach((g) => {
      g.participants.forEach((p) => {
        dogs.push({
          key: `workshop-${g.id}-${p.id}`,
          dogName: p.dog.name,
          customerName: p.customer.name,
          customerPhone: p.customer.phone,
          type: "workshop",
          status: p.status,
          detail: g.name,
          entityId: g.id,
        });
      });
    });

    return dogs;
  }, [programs, activeStays, regularGroups, workshops]);

  const filteredDogs = useMemo(() => {
    if (!searchQuery.trim()) return allDogs;
    const q = searchQuery.toLowerCase();
    return allDogs.filter(
      (d) =>
        d.dogName.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q)
    );
  }, [allDogs, searchQuery]);

  // ─── Mutations ───

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ programId, sessionNumber, summary, sessionDate, rating }: { programId: string; sessionNumber: number; summary?: string; sessionDate?: string; rating?: number | null }) => {
      const res = await fetch(`/api/training-programs/${programId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: sessionDate ? new Date(sessionDate).toISOString() : new Date().toISOString(),
          status: "COMPLETED",
          sessionNumber,
          durationMinutes: 60,
          ...(summary ? { summary } : {}),
          ...(rating != null ? { rating } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setSessionLogTarget(null);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/training-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowNewGroup(false);
      setShowNewWorkshop(false);
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async ({ groupId, customerId, dogId }: { groupId: string; customerId: string; dogId: string }) => {
      const res = await fetch(`/api/training-groups/${groupId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, dogId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowAssignDog(null);
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async ({ groupId, participantId }: { groupId: string; participantId: string }) => {
      const res = await fetch(`/api/training-groups/${groupId}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-groups"] }),
  });

  const createProgramMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setShowSellPackage(false);
    },
  });

  const updateProgramSettingsMutation = useMutation({
    mutationFn: async ({
      id,
      startDate,
      endDate,
      location,
      frequency,
    }: {
      id: string;
      startDate: string;
      endDate: string | null;
      location: string | null;
      frequency: string | null;
    }) => {
      const res = await fetch(`/api/training-programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, location, frequency }),
      });
      if (!res.ok) throw new Error("Failed to update program settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setEditingProgram(null);
    },
  });

  // ─── Helpers ───

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activePrograms = programs.filter((p) => p.status === "ACTIVE");

  // ─── Stats ───

  const stats = [
    { label: "כלבים באימון", value: allDogs.length, color: "bg-orange-50 text-orange-600", iconBg: "bg-orange-100" },
    { label: "אימון אישי", value: activePrograms.length, color: "bg-blue-50 text-blue-600", iconBg: "bg-blue-100" },
    { label: "אימון בפנסיון", value: activeStays.length, color: "bg-green-50 text-green-600", iconBg: "bg-green-100" },
    { label: "קבוצות וסדנאות", value: regularGroups.length + workshops.length, color: "bg-purple-50 text-purple-600", iconBg: "bg-purple-100" },
  ];

  const statIcons = [
    <Dog key="dog" className="w-5 h-5" />,
    <GraduationCap key="grad" className="w-5 h-5" />,
    <Hotel key="hotel" className="w-5 h-5" />,
    <Users key="users" className="w-5 h-5" />,
  ];

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-brand-500" />
        </div>
        <h1 className="page-title">אימונים וניהול כלבים</h1>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat, i) => (
          <div key={stat.label} className={cn("card p-4 flex items-center gap-3", stat.color)}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.iconBg)}>
              {statIcons[i]}
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "..." : stat.value}</p>
              <p className="text-xs opacity-75">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
        <input
          className="input pr-10 w-full"
          placeholder="חיפוש לפי שם כלב או בעלים..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === tab.id
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-petra-muted hover:bg-slate-200"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && (
            <OverviewTab dogs={filteredDogs} />
          )}

          {/* ═══ INDIVIDUAL TAB ═══ */}
          {activeTab === "individual" && (
            <IndividualTab
              programs={programs}
              searchQuery={searchQuery}
              expandedCards={expandedCards}
              toggleExpand={toggleExpand}
              onMarkAttendance={(programId, sessionNumber, dogName) =>
                setSessionLogTarget({ programId, sessionNumber, dogName })
              }
              onEditSettings={(program) => setEditingProgram(program)}
              isMarkingAttendance={markAttendanceMutation.isPending}
            />
          )}

          {/* ═══ BOARDING TAB ═══ */}
          {activeTab === "boarding" && (
            <BoardingTab stays={activeStays} searchQuery={searchQuery} />
          )}

          {/* ═══ GROUPS TAB ═══ */}
          {activeTab === "groups" && (
            <GroupsTab
              groups={regularGroups}
              searchQuery={searchQuery}
              expandedCards={expandedCards}
              toggleExpand={toggleExpand}
              onNewGroup={() => setShowNewGroup(true)}
              onAssignDog={(groupId, groupName) => setShowAssignDog({ groupId, groupName })}
              onRemoveParticipant={(groupId, participantId) =>
                removeParticipantMutation.mutate({ groupId, participantId })
              }
            />
          )}

          {/* ═══ WORKSHOPS TAB ═══ */}
          {activeTab === "workshops" && (
            <WorkshopsTab
              workshops={workshops}
              searchQuery={searchQuery}
              expandedCards={expandedCards}
              toggleExpand={toggleExpand}
              onNewWorkshop={() => setShowNewWorkshop(true)}
              onAssignDog={(groupId, groupName) => setShowAssignDog({ groupId, groupName })}
              onRemoveParticipant={(groupId, participantId) =>
                removeParticipantMutation.mutate({ groupId, participantId })
              }
            />
          )}
        </>
      )}

      {/* ═══ MODALS ═══ */}

      {showSellPackage && (
        <SellPackageModal
          onClose={() => setShowSellPackage(false)}
          onSubmit={(data) => createProgramMutation.mutate(data)}
          isPending={createProgramMutation.isPending}
        />
      )}

      {editingProgram && (
        <ProgramSettingsModal
          program={editingProgram}
          onClose={() => setEditingProgram(null)}
          onSubmit={(data) => updateProgramSettingsMutation.mutate({ id: editingProgram.id, ...data })}
          isPending={updateProgramSettingsMutation.isPending}
        />
      )}

      {showNewGroup && (
        <CreateGroupModal
          onClose={() => setShowNewGroup(false)}
          onSubmit={(data) => createGroupMutation.mutate(data)}
          isPending={createGroupMutation.isPending}
          isWorkshop={false}
        />
      )}

      {showNewWorkshop && (
        <CreateGroupModal
          onClose={() => setShowNewWorkshop(false)}
          onSubmit={(data) => createGroupMutation.mutate({ ...data, groupType: "WORKSHOP" })}
          isPending={createGroupMutation.isPending}
          isWorkshop={true}
        />
      )}

      {showAssignDog && (
        <AssignDogModal
          groupId={showAssignDog.groupId}
          groupName={showAssignDog.groupName}
          onClose={() => setShowAssignDog(null)}
          onSubmit={(customerId, dogId) =>
            addParticipantMutation.mutate({
              groupId: showAssignDog.groupId,
              customerId,
              dogId,
            })
          }
          isPending={addParticipantMutation.isPending}
          error={addParticipantMutation.error?.message || null}
        />
      )}

      {sessionLogTarget && (
        <SessionLogModal
          dogName={sessionLogTarget.dogName}
          sessionNumber={sessionLogTarget.sessionNumber}
          isPending={markAttendanceMutation.isPending}
          onClose={() => setSessionLogTarget(null)}
          onSubmit={(summary, sessionDate, rating) =>
            markAttendanceMutation.mutate({
              programId: sessionLogTarget.programId,
              sessionNumber: sessionLogTarget.sessionNumber,
              summary,
              sessionDate,
              rating,
            })
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════

function OverviewTab({ dogs }: { dogs: UnifiedDog[] }) {
  if (dogs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Dog className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">אין כלבים באימון</h3>
        <p className="text-sm text-petra-muted">הוסף כלבים לאימון דרך הטאבים השונים</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {dogs.map((dog) => {
        const badge = TYPE_BADGE[dog.type];
        return (
          <div key={dog.key} className="card p-4 card-hover">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-sm font-bold text-brand-600">
                {dog.dogName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-petra-text truncate">{dog.dogName}</h3>
                <p className="text-xs text-petra-muted truncate">{dog.customerName}</p>
              </div>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", badge.bg, badge.text)}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-petra-muted mb-2">{dog.detail}</p>
            {dog.progress && (
              <div>
                <div className="flex justify-between text-[10px] text-petra-muted mb-1">
                  <span>מפגשים</span>
                  <span>{dog.progress.used}/{dog.progress.total}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (dog.progress.used / dog.progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// INDIVIDUAL TAB
// ═══════════════════════════════════════════════════════
// GOAL PROGRESS ROW
// ═══════════════════════════════════════════════════════

function GoalProgressRow({ goal, programId }: { goal: { id: string; title: string; status: string; progressPercent: number }; programId: string }) {
  const queryClient = useQueryClient();
  const [localProgress, setLocalProgress] = useState(goal.progressPercent);

  const mutation = useMutation({
    mutationFn: (progress: number) =>
      fetchJSON(`/api/training-programs/${programId}/goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId: goal.id,
          progressPercent: progress,
          status: progress >= 100 ? "ACHIEVED" : progress > 0 ? "IN_PROGRESS" : "PENDING",
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-programs"] }),
    onError: () => toast.error("שגיאה בעדכון יעד"),
  });

  const statusColor = goal.status === "ACHIEVED" ? "text-emerald-600" : goal.status === "IN_PROGRESS" ? "text-brand-600" : "text-petra-muted";

  return (
    <div className="p-2 rounded-lg bg-slate-50 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-semibold flex-shrink-0", statusColor)}>
          {goal.status === "ACHIEVED" ? "✓" : goal.status === "IN_PROGRESS" ? "●" : "○"}
        </span>
        <span className="text-xs text-petra-text flex-1 truncate">{goal.title}</span>
        <span className="text-[10px] text-petra-muted font-medium">{localProgress}%</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={localProgress}
          onChange={(e) => setLocalProgress(parseInt(e.target.value))}
          onMouseUp={() => { if (localProgress !== goal.progressPercent) mutation.mutate(localProgress); }}
          onTouchEnd={() => { if (localProgress !== goal.progressPercent) mutation.mutate(localProgress); }}
          className="flex-1 accent-brand-500 h-1.5"
        />
      </div>
      <div
        className="h-1.5 rounded-full bg-slate-200 overflow-hidden"
      >
        <div
          className={cn("h-full rounded-full transition-all", localProgress >= 100 ? "bg-emerald-500" : "bg-brand-500")}
          style={{ width: `${localProgress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Homework Section ────────────────────────────────────────────────────────

function HomeworkSection({ program }: { program: TrainingProgram }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: ({ homeworkId, isCompleted }: { homeworkId: string; isCompleted: boolean }) =>
      fetchJSON(`/api/training-programs/${program.id}/homework`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkId, isCompleted }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-programs"] }),
    onError: () => toast.error("שגיאה בעדכון שיעורי בית"),
  });

  const addMutation = useMutation({
    mutationFn: (title: string) =>
      fetchJSON(`/api/training-programs/${program.id}/homework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setNewTitle("");
      setShowAdd(false);
      toast.success("שיעור בית נוסף ✓");
    },
    onError: () => toast.error("שגיאה בהוספת שיעור בית"),
  });

  const deleteMutation = useMutation({
    mutationFn: (homeworkId: string) =>
      fetchJSON(`/api/training-programs/${program.id}/homework?homeworkId=${homeworkId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-programs"] }),
    onError: () => toast.error("שגיאה במחיקת שיעור בית"),
  });

  const completed = program.homework.filter((h) => h.isCompleted).length;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-3.5 h-3.5 text-petra-muted" />
        <h4 className="text-xs font-semibold text-petra-muted flex-1">
          שיעורי בית ({completed}/{program.homework.length})
        </h4>
        {program.customer.phone && program.homework.filter((h) => !h.isCompleted).length > 0 && (() => {
          const pending = program.homework.filter((h) => !h.isCompleted);
          const lines = [
            `📝 שיעורי בית לאימון — ${program.dog.name}`,
            "",
            ...pending.map((h, i) => `${i + 1}. ${h.title}`),
            "",
            "יש להתאמן על הנקודות הנ״ל עד המפגש הבא 🐾",
          ];
          return (
            <a
              href={`https://wa.me/${toWhatsAppPhone(program.customer.phone)}?text=${encodeURIComponent(lines.join("\n"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-green-700 hover:text-green-800 font-medium flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded"
              title="שלח שיעורי בית"
              onClick={(e) => e.stopPropagation()}
            >
              <Send className="w-2.5 h-2.5" />
              שלח
            </a>
          );
        })()}
        <button
          className="text-[10px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="w-3 h-3" />
          הוסף
        </button>
      </div>

      {program.homework.length === 0 && !showAdd && (
        <p className="text-xs text-petra-muted">אין שיעורי בית עדיין</p>
      )}

      <div className="space-y-1.5">
        {program.homework.map((hw) => (
          <div
            key={hw.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg transition-colors",
              hw.isCompleted ? "bg-emerald-50" : "bg-slate-50"
            )}
          >
            <button
              onClick={() => toggleMutation.mutate({ homeworkId: hw.id, isCompleted: !hw.isCompleted })}
              disabled={toggleMutation.isPending}
              className="flex-shrink-0"
            >
              {hw.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 hover:text-brand-400" />
              )}
            </button>
            <span className={cn("text-xs flex-1", hw.isCompleted ? "line-through text-petra-muted" : "text-petra-text")}>
              {hw.title}
            </span>
            <button
              onClick={() => deleteMutation.mutate(hw.id)}
              disabled={deleteMutation.isPending}
              className="text-petra-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            type="text"
            className="input text-xs flex-1 py-1"
            placeholder="תיאור שיעור הבית..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) addMutation.mutate(newTitle.trim());
              if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
            }}
          />
          <button
            className="btn-primary text-xs px-2 py-1"
            disabled={!newTitle.trim() || addMutation.isPending}
            onClick={() => { if (newTitle.trim()) addMutation.mutate(newTitle.trim()); }}
          >
            {addMutation.isPending ? "..." : "הוסף"}
          </button>
          <button className="btn-secondary text-xs px-2 py-1" onClick={() => { setShowAdd(false); setNewTitle(""); }}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════

function IndividualTab({
  programs,
  searchQuery,
  expandedCards,
  toggleExpand,
  onMarkAttendance,
  isMarkingAttendance,
  onEditSettings,
}: {
  programs: TrainingProgram[];
  searchQuery: string;
  expandedCards: Set<string>;
  toggleExpand: (id: string) => void;
  onMarkAttendance: (programId: string, sessionNumber: number, dogName: string) => void;
  onEditSettings: (program: TrainingProgram) => void;
  isMarkingAttendance: boolean;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter(
      (p) =>
        p.dog.name.toLowerCase().includes(q) ||
        p.customer.name.toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} תוכניות אילוף</p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GraduationCap className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תוכניות אילוף בבית לקוח</h3>
          <p className="text-sm text-petra-muted">חבילות אילוף יופיעו כאן לאחר מכירה דרך &ldquo;הזמנה חדשה&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((program) => {
            const expanded = expandedCards.has(program.id);
            const usedSessions = program.sessions.filter((s) => s.status === "COMPLETED").length;
            const remaining = program.totalSessions ? program.totalSessions - usedSessions : null;
            const statusInfo = PROGRAM_STATUS_MAP[program.status] || PROGRAM_STATUS_MAP.ACTIVE;
            const isLowSessions = remaining !== null && remaining <= 2 && program.status === "ACTIVE";
            const typeColors = PROGRAM_TYPE_COLORS[program.programType];

            return (
              <div key={program.id} className="card overflow-hidden">
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(program.id)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: typeColors?.bg || "#EFF6FF" }}
                  >
                    <Dog className="w-5 h-5" style={{ color: typeColors?.text || "#2563EB" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-petra-text">{program.dog.name}</h3>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                      {isLowSessions && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          מפגשים נמוכים
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-petra-muted">
                      <span>{program.customer.name}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: typeColors?.bg || "#EFF6FF",
                          color: typeColors?.text || "#2563EB",
                        }}
                      >
                        {PROGRAM_TYPES_MAP[program.programType] || program.programType}
                      </span>
                      {program.price && (
                        <span>{formatCurrency(program.price)}</span>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {program.totalSessions && (
                    <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                      <span className="text-lg font-bold text-brand-500">
                        {usedSessions}/{program.totalSessions}
                      </span>
                      <div className="w-full h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all"
                          style={{ width: `${Math.min(100, (usedSessions / program.totalSessions) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {expanded && (
                  <div className="border-t border-petra-border p-4">
                    {/* Actions */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {program.status === "ACTIVE" && (
                        <button
                          className="btn-primary text-xs"
                          disabled={isMarkingAttendance}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAttendance(program.id, usedSessions + 1, program.dog.name);
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          סמן נוכחות
                        </button>
                      )}
                      <button
                        className="btn-secondary text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSettings(program);
                        }}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        הגדרות
                      </button>
                      {program.customer.phone && (
                        <a
                          href={(() => {
                            const completedGoals = program.goals?.filter((g: { status: string }) => g.status === "ACHIEVED").length ?? 0;
                            const totalGoals = program.goals?.length ?? 0;
                            const completedHomework = program.homework?.filter((h: { isCompleted: boolean }) => h.isCompleted).length ?? 0;
                            const totalHomework = program.homework?.length ?? 0;
                            const lastSession = [...(program.sessions ?? [])].sort(
                              (a, b) => ((b.sessionNumber ?? 0) - (a.sessionNumber ?? 0))
                            )[0];
                            const lines = [
                              `שלום ${program.customer.name}! 🐾`,
                              `דוח התקדמות אילוף — ${program.dog.name}`,
                              "",
                              `📊 מפגשים: ${usedSessions}${program.totalSessions ? `/${program.totalSessions}` : ""}`,
                            ];
                            if (totalGoals > 0) lines.push(`🎯 יעדים: ${completedGoals}/${totalGoals} הושגו`);
                            if (totalHomework > 0) lines.push(`📝 שיעורי בית: ${completedHomework}/${totalHomework} הושלמו`);
                            if (lastSession?.summary) {
                              lines.push("", `💬 סיכום מפגש אחרון:`, lastSession.summary);
                            }
                            return `https://wa.me/${toWhatsAppPhone(program.customer.phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Send className="w-3.5 h-3.5" />
                          שלח דוח
                        </a>
                      )}
                      {program.customer.phone && program.status === "COMPLETED" && (
                        <a
                          href={(() => {
                            const completedGoals = program.goals?.filter((g: { status: string }) => g.status === "ACHIEVED").length ?? 0;
                            const totalGoals = program.goals?.length ?? 0;
                            const lines = [
                              `🎓 *תעודת סיום אילוף*`,
                              "",
                              `כלב: ${program.dog.name}${program.dog.breed ? ` (${program.dog.breed})` : ""}`,
                              `בעלים: ${program.customer.name}`,
                              `תוכנית: ${program.name}`,
                              `מפגשים שהושלמו: ${usedSessions}`,
                              totalGoals > 0 ? `יעדים שהושגו: ${completedGoals}/${totalGoals}` : "",
                              "",
                              `🏆 ${program.dog.name} סיים/ה בהצלחה את תוכנית האילוף!`,
                              `מברכים אתכם ומאחלים המשך הנאה עם הכלב! 🐾`,
                            ].filter(Boolean);
                            return `https://wa.me/${toWhatsAppPhone(program.customer.phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                          onClick={(e) => e.stopPropagation()}
                          title="שלח תעודת סיום"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          תעודת סיום
                        </a>
                      )}
                    </div>

                    {/* Details Info */}
                    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-petra-muted bg-slate-50 p-3 rounded-xl border border-petra-border">
                      <div>
                        <span className="font-semibold block mb-0.5">תאריך התחלה</span>
                        {program.startDate ? formatDate(program.startDate) : "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">יעד סיום משוער</span>
                        {program.endDate ? formatDate(program.endDate) : "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">מיקום</span>
                        {program.location || "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">תדירות מפגשים</span>
                        {program.frequency === "WEEKLY" ? "אחת לשבוע" :
                          program.frequency === "BIWEEKLY" ? "אחת לשבועיים" :
                            program.frequency || "-"}
                      </div>
                    </div>

                    {/* Goals */}
                    {program.goals && program.goals.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-petra-muted mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          יעדי אילוף ({program.goals.length})
                        </h4>
                        <div className="space-y-2">
                          {program.goals.map((goal) => (
                            <GoalProgressRow
                              key={goal.id}
                              goal={goal}
                              programId={program.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Homework */}
                    <HomeworkSection program={program} />

                    {/* Sessions list */}
                    <h4 className="text-xs font-semibold text-petra-muted mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      מפגשים ({program.sessions.length})
                    </h4>
                    {program.sessions.length === 0 ? (
                      <p className="text-xs text-petra-muted">אין מפגשים עדיין</p>
                    ) : (
                      <div className="space-y-1.5">
                        {program.sessions.slice(0, 10).map((session) => (
                          <div key={session.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              session.status === "COMPLETED" ? "bg-emerald-500" :
                                session.status === "CANCELED" ? "bg-red-400" : "bg-blue-400"
                            )} />
                            <span className="text-xs text-petra-text">מפגש {session.sessionNumber || ""}</span>
                            <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDate)}</span>
                            {session.rating && (
                              <span className="text-[11px] text-amber-500 mr-auto">{"★".repeat(session.rating)}{"☆".repeat(5 - session.rating)}</span>
                            )}
                            {!session.rating && session.summary && (
                              <span className="text-[10px] text-petra-muted truncate max-w-[200px] mr-auto">{session.summary}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {program.notes && (
                      <div className="mt-3 p-2 rounded-lg bg-amber-50 text-xs text-amber-800">{program.notes}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BOARDING TAB
// ═══════════════════════════════════════════════════════

function BoardingTab({ stays, searchQuery }: { stays: BoardingStay[]; searchQuery: string }) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stays;
    const q = searchQuery.toLowerCase();
    return stays.filter(
      (s) =>
        s.pet.name.toLowerCase().includes(q) ||
        s.customer.name.toLowerCase().includes(q)
    );
  }, [stays, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Hotel className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">אין כלבים בפנסיון</h3>
        <p className="text-sm text-petra-muted">כרגע אין כלבים עם סטטוס checked-in</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {filtered.map((stay) => {
        const daysLeft = stay.checkOut
          ? Math.ceil((new Date(stay.checkOut).getTime() - Date.now()) / 86400000)
          : null;
        const urgency =
          daysLeft === null ? "neutral" :
            daysLeft <= 0 ? "danger" :
              daysLeft <= 3 ? "warning" : "success";
        const urgencyColor = {
          success: "bg-green-100 text-green-700",
          warning: "bg-yellow-100 text-yellow-700",
          danger: "bg-red-100 text-red-700",
          neutral: "bg-slate-100 text-slate-600",
        }[urgency];

        return (
          <div key={stay.id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-sm font-bold text-green-600">
                {stay.pet.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</h3>
                <p className="text-xs text-petra-muted truncate">{stay.customer.name}</p>
              </div>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", urgencyColor)}>
                {daysLeft !== null ? (daysLeft <= 0 ? "עבר מועד" : `${daysLeft} ימים`) : "פתוח"}
              </span>
            </div>
            <div className="space-y-1 text-xs text-petra-muted">
              {stay.room && (
                <div className="flex items-center gap-1.5">
                  <Hotel className="w-3 h-3" />
                  <span>חדר: {stay.room.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                <span>כניסה: {formatDate(stay.checkIn)}</span>
              </div>
              {stay.checkOut && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span>יציאה: {formatDate(stay.checkOut)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GROUPS TAB
// ═══════════════════════════════════════════════════════

function GroupsTab({
  groups,
  searchQuery,
  expandedCards,
  toggleExpand,
  onNewGroup,
  onAssignDog,
  onRemoveParticipant,
}: {
  groups: TrainingGroup[];
  searchQuery: string;
  expandedCards: Set<string>;
  toggleExpand: (id: string) => void;
  onNewGroup: () => void;
  onAssignDog: (groupId: string, groupName: string) => void;
  onRemoveParticipant: (groupId: string, participantId: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.participants.some(
          (p) => p.dog.name.toLowerCase().includes(q) || p.customer.name.toLowerCase().includes(q)
        )
    );
  }, [groups, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} קבוצות</p>
        <button className="btn-primary" onClick={onNewGroup}>
          <Plus className="w-4 h-4" />
          קבוצה חדשה
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין קבוצות אימון</h3>
          <p className="text-sm text-petra-muted">צור קבוצת אימון חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              expanded={expandedCards.has(group.id)}
              onToggle={() => toggleExpand(group.id)}
              onAssignDog={() => onAssignDog(group.id, group.name)}
              onRemoveParticipant={(participantId) => onRemoveParticipant(group.id, participantId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WORKSHOPS TAB
// ═══════════════════════════════════════════════════════

function WorkshopsTab({
  workshops,
  searchQuery,
  expandedCards,
  toggleExpand,
  onNewWorkshop,
  onAssignDog,
  onRemoveParticipant,
}: {
  workshops: TrainingGroup[];
  searchQuery: string;
  expandedCards: Set<string>;
  toggleExpand: (id: string) => void;
  onNewWorkshop: () => void;
  onAssignDog: (groupId: string, groupName: string) => void;
  onRemoveParticipant: (groupId: string, participantId: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return workshops;
    const q = searchQuery.toLowerCase();
    return workshops.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.participants.some(
          (p) => p.dog.name.toLowerCase().includes(q) || p.customer.name.toLowerCase().includes(q)
        )
    );
  }, [workshops, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} סדנאות</p>
        <button className="btn-primary" onClick={onNewWorkshop}>
          <Plus className="w-4 h-4" />
          סדנה חדשה
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין סדנאות</h3>
          <p className="text-sm text-petra-muted">צור סדנה חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((workshop) => (
            <GroupCard
              key={workshop.id}
              group={workshop}
              expanded={expandedCards.has(workshop.id)}
              onToggle={() => toggleExpand(workshop.id)}
              onAssignDog={() => onAssignDog(workshop.id, workshop.name)}
              onRemoveParticipant={(participantId) => onRemoveParticipant(workshop.id, participantId)}
              isWorkshop
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GROUP / WORKSHOP CARD
// ═══════════════════════════════════════════════════════

function GroupCard({
  group,
  expanded,
  onToggle,
  onAssignDog,
  onRemoveParticipant,
  isWorkshop = false,
}: {
  group: TrainingGroup;
  expanded: boolean;
  onToggle: () => void;
  onAssignDog: () => void;
  onRemoveParticipant: (participantId: string) => void;
  isWorkshop?: boolean;
}) {
  const queryClient = useQueryClient();
  const [expandedAttendanceSession, setExpandedAttendanceSession] = useState<string | null>(null);
  const [sessionNotesInput, setSessionNotesInput] = useState<Record<string, string>>({});
  const [showAddSession, setShowAddSession] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const defaultTime = group.defaultTime || "10:00";
  const [newSessionDate, setNewSessionDate] = useState(today);
  const [newSessionTime, setNewSessionTime] = useState(defaultTime);

  const addSessionMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/training-groups/${group.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDatetime: `${newSessionDate}T${newSessionTime}:00`, status: "SCHEDULED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowAddSession(false);
      toast.success("מפגש נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת מפגש"),
  });
  const typeColor = GROUP_TYPE_COLORS[group.groupType] || GROUP_TYPE_COLORS.CUSTOM;

  const attendanceMutation = useMutation({
    mutationFn: ({ attendanceId, status }: { attendanceId: string; status: string }) =>
      fetchJSON(`/api/training-attendance/${attendanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceStatus: status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-groups"] }),
    onError: () => toast.error("שגיאה בעדכון נוכחות"),
  });

  const sessionNotesMutation = useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes: string }) =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, status: "COMPLETED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      toast.success("סיכום המפגש נשמר");
    },
    onError: () => toast.error("שגיאה בשמירת הסיכום"),
  });

  return (
    <div className="card overflow-hidden">
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: typeColor.bg }}
        >
          {isWorkshop
            ? <Calendar className="w-5 h-5" style={{ color: typeColor.text }} />
            : <GraduationCap className="w-5 h-5" style={{ color: typeColor.text }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-petra-text">{group.name}</h3>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: typeColor.bg, color: typeColor.text }}
            >
              {GROUP_TYPE_LABELS[group.groupType] || group.groupType}
            </span>
            {!group.isActive && <span className="badge-danger text-[10px]">לא פעיל</span>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-petra-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {group._count.participants} משתתפים
              {group.maxParticipants && ` / ${group.maxParticipants}`}
            </span>
            {group.defaultDayOfWeek !== null && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                יום {DAY_NAMES[group.defaultDayOfWeek]}
              </span>
            )}
            {group.defaultTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {group.defaultTime}
              </span>
            )}
            {group.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {group.location}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="border-t border-petra-border">
          {/* Actions */}
          <div className="p-4 pb-2 flex gap-2 flex-wrap">
            <button
              className="btn-primary text-xs"
              onClick={(e) => { e.stopPropagation(); setShowAddSession(!showAddSession); }}
            >
              <Plus className="w-3.5 h-3.5" />
              הוסף מפגש
            </button>
            <button className="btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); onAssignDog(); }}>
              <Plus className="w-3.5 h-3.5" />
              שייך כלב
            </button>
            {isWorkshop && group.participants.length > 0 && (
              <button
                className="btn-secondary text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // Open WhatsApp for each participant
                  group.participants.forEach((p) => {
                    if (p.customer.phone) {
                      const phone = toWhatsAppPhone(p.customer.phone);
                      const msg = encodeURIComponent(
                        `היי! תזכורת לסדנת "${group.name}"${group.location ? ` ב${group.location}` : ""}${group.defaultTime ? ` בשעה ${group.defaultTime}` : ""}. נתראה!`
                      );
                      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                    }
                  });
                }}
              >
                <Send className="w-3.5 h-3.5" />
                שלח תזכורת
              </button>
            )}
          </div>

          {/* Add Session Inline Form */}
          {showAddSession && (
            <div className="mx-4 mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2">
              <p className="text-xs font-semibold text-brand-700">מפגש חדש</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label text-[10px]">תאריך</label>
                  <input
                    type="date"
                    className="input text-xs py-1.5"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <label className="label text-[10px]">שעה</label>
                  <input
                    type="time"
                    className="input text-xs py-1.5"
                    value={newSessionTime}
                    onChange={(e) => setNewSessionTime(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary text-xs flex-1"
                  disabled={addSessionMutation.isPending || !newSessionDate}
                  onClick={(e) => { e.stopPropagation(); addSessionMutation.mutate(); }}
                >
                  {addSessionMutation.isPending ? "יוצר..." : "צור מפגש"}
                </button>
                <button
                  className="btn-secondary text-xs"
                  onClick={(e) => { e.stopPropagation(); setShowAddSession(false); }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="p-4 border-b border-petra-border">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Dog className="w-3.5 h-3.5" />
              משתתפים ({group.participants.length})
            </h4>
            {group.participants.length === 0 ? (
              <p className="text-xs text-petra-muted">אין משתתפים רשומים</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 group/item">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center text-xs font-bold text-brand-600">
                      {p.dog.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-petra-text truncate">
                        {p.dog.name}
                        {p.dog.breed && <span className="text-petra-muted font-normal"> ({p.dog.breed})</span>}
                      </p>
                      <p className="text-[10px] text-petra-muted truncate">{p.customer.name}</p>
                    </div>
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onRemoveParticipant(p.id); }}
                      title="הסר משתתף"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              מפגשים ({group._count.sessions})
            </h4>
            {group.sessions.length === 0 ? (
              <p className="text-xs text-petra-muted">אין מפגשים</p>
            ) : (
              <div className="space-y-1.5">
                {group.sessions.slice(0, 5).map((session) => {
                  const isAttendanceOpen = expandedAttendanceSession === session.id;
                  const presentCount = session.attendance.filter((a) => a.attendanceStatus === "PRESENT").length;
                  return (
                    <div key={session.id} className="rounded-lg bg-slate-50 overflow-hidden">
                      <div className="flex items-center gap-3 p-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          session.status === "COMPLETED" ? "bg-emerald-500" :
                            session.status === "CANCELED" ? "bg-red-400" : "bg-blue-400"
                        )} />
                        <span className="text-xs text-petra-text">מפגש {session.sessionNumber || ""}</span>
                        <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDatetime)}</span>
                        <span className="text-[10px] badge-neutral">{presentCount}/{session.attendance.length || group.participants.length} נוכחים</span>
                        {session.attendance.length > 0 && (
                          <button
                            className="mr-auto text-[10px] text-brand-600 hover:text-brand-700 font-medium"
                            onClick={(e) => { e.stopPropagation(); setExpandedAttendanceSession(isAttendanceOpen ? null : session.id); }}
                          >
                            {isAttendanceOpen ? "סגור" : "סמן נוכחות"}
                          </button>
                        )}
                      </div>
                      {isAttendanceOpen && (
                        <div className="px-3 pb-3 border-t border-slate-200 pt-2 space-y-1.5">
                          {session.attendance.map((att) => {
                            const participant = group.participants.find((p) => p.id === att.participantId);
                            const dogName = att.participant?.dog.name ?? participant?.dog.name ?? "כלב";
                            const customerName = att.participant?.customer.name ?? participant?.customer.name ?? "";
                            const isPresent = att.attendanceStatus === "PRESENT";
                            return (
                              <div key={att.id} className="flex items-center gap-2">
                                <button
                                  className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors flex-shrink-0",
                                    isPresent
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "bg-white border-red-300 text-red-400"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    attendanceMutation.mutate({ attendanceId: att.id, status: isPresent ? "NO_SHOW" : "PRESENT" });
                                  }}
                                  disabled={attendanceMutation.isPending}
                                  title={isPresent ? "סמן כנעדר" : "סמן כנוכח"}
                                >
                                  {isPresent ? "✓" : "✗"}
                                </button>
                                <span className="text-xs text-petra-text font-medium">{dogName}</span>
                                {customerName && <span className="text-[10px] text-petra-muted">{customerName}</span>}
                                <span className={cn(
                                  "text-[10px] mr-auto",
                                  isPresent ? "text-emerald-600" : "text-red-500"
                                )}>
                                  {isPresent ? "נוכח" : "נעדר"}
                                </span>
                              </div>
                            );
                          })}
                          {/* Session notes */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <p className="text-[10px] font-semibold text-petra-muted">סיכום מפגש</p>
                            <textarea
                              className="input text-xs py-1.5 resize-none w-full"
                              rows={2}
                              placeholder="מה עבדנו היום, הצלחות, נקודות לשיפור..."
                              value={sessionNotesInput[session.id] ?? session.notes ?? ""}
                              onChange={(e) => setSessionNotesInput((prev) => ({ ...prev, [session.id]: e.target.value }))}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              className="btn-primary text-[11px] py-1 px-3"
                              disabled={sessionNotesMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                sessionNotesMutation.mutate({ sessionId: session.id, notes: sessionNotesInput[session.id] ?? session.notes ?? "" });
                              }}
                            >
                              שמור סיכום
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SELL PACKAGE MODAL
// ═══════════════════════════════════════════════════════

function SellPackageModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");
  const [programType, setProgramType] = useState("BASIC_OBEDIENCE");
  const [totalSessions, setTotalSessions] = useState("10");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["customers-full"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
  });

  const customersWithPets = useMemo(
    () => customers.filter((c) => c.pets && c.pets.length > 0),
    [customers]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedDog = selectedCustomer?.pets.find((p) => p.id === dogId);
  const autoName = selectedDog
    ? `אילוף ${PROGRAM_TYPES_MAP[programType] || programType} - ${selectedDog.name}`
    : "";

  const handleSubmit = () => {
    if (!customerId || !dogId || !totalSessions) return;
    onSubmit({
      customerId,
      dogId,
      name: autoName,
      programType,
      totalSessions: parseInt(totalSessions),
      price: price ? parseFloat(price) : null,
      notes: notes || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-500" />
            מכירת חבילת אימון
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="label">לקוח *</label>
            {customersLoading ? (
              <div className="input bg-slate-50 text-petra-muted text-sm">טוען לקוחות...</div>
            ) : (
              <select
                className="input"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setDogId(""); }}
              >
                <option value="">בחר לקוח...</option>
                {customersWithPets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone} ({c.pets.length} כלבים)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dog */}
          {customerId && selectedCustomer && (
            <div>
              <label className="label">כלב *</label>
              <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                <option value="">בחר כלב...</option>
                {selectedCustomer.pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>{pet.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Program Type */}
          <div>
            <label className="label">סוג תוכנית</label>
            <select className="input" value={programType} onChange={(e) => setProgramType(e.target.value)}>
              {Object.entries(PROGRAM_TYPES_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Auto Name */}
          {autoName && (
            <div>
              <label className="label">שם תוכנית</label>
              <input className="input bg-slate-50" value={autoName} readOnly />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מספר מפגשים *</label>
              <input
                type="number"
                className="input"
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                min="1"
              />
            </div>
            <div>
              <label className="label">מחיר (₪)</label>
              <input
                type="number"
                className="input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!customerId || !dogId || !totalSessions || isPending}
            onClick={handleSubmit}
          >
            <Package className="w-4 h-4" />
            {isPending ? "שומר..." : "צור חבילה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE GROUP / WORKSHOP MODAL
// ═══════════════════════════════════════════════════════

function CreateGroupModal({
  onClose,
  onSubmit,
  isPending,
  isWorkshop,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  isWorkshop: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    groupType: isWorkshop ? "WORKSHOP" : "CUSTOM",
    location: "",
    defaultDayOfWeek: "",
    defaultTime: "",
    maxParticipants: "",
    notes: "",
  });

  const handleSubmit = () => {
    if (!form.name) return;
    onSubmit({
      name: form.name,
      groupType: form.groupType,
      location: form.location || null,
      defaultDayOfWeek: form.defaultDayOfWeek ? parseInt(form.defaultDayOfWeek) : null,
      defaultTime: form.defaultTime || null,
      maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : null,
      notes: form.notes || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">
            {isWorkshop ? "סדנה חדשה" : "קבוצת אימון חדשה"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם {isWorkshop ? "הסדנה" : "הקבוצה"} *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isWorkshop ? "למשל: סדנת סוציאליזציה" : "למשל: קבוצת גורים - מחזור 3"}
            />
          </div>

          {!isWorkshop && (
            <div>
              <label className="label">סוג</label>
              <select
                className="input"
                value={form.groupType}
                onChange={(e) => setForm({ ...form, groupType: e.target.value })}
              >
                {Object.entries(GROUP_TYPES_MAP)
                  .filter(([k]) => k !== "WORKSHOP")
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">יום קבוע</label>
              <select
                className="input"
                value={form.defaultDayOfWeek}
                onChange={(e) => setForm({ ...form, defaultDayOfWeek: e.target.value })}
              >
                <option value="">לא נקבע</option>
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">שעה</label>
              <input
                type="time"
                className="input"
                value={form.defaultTime}
                onChange={(e) => setForm({ ...form, defaultTime: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מיקום</label>
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="גן ציבורי..."
              />
            </div>
            <div>
              <label className="label">מקסימום משתתפים</label>
              <input
                type="number"
                className="input"
                value={form.maxParticipants}
                onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                placeholder="6"
              />
            </div>
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || isPending}
            onClick={handleSubmit}
          >
            <Plus className="w-4 h-4" />
            {isPending ? "שומר..." : isWorkshop ? "צור סדנה" : "צור קבוצה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ASSIGN DOG MODAL
// ═══════════════════════════════════════════════════════

function AssignDogModal({
  groupId: _groupId,
  groupName,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSubmit: (customerId: string, dogId: string) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["customers-full"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
  });

  const customersWithPets = useMemo(
    () => customers.filter((c) => c.pets && c.pets.length > 0),
    [customers]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">שיוך כלב ל{groupName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="label">לקוח *</label>
            {customersLoading ? (
              <div className="input bg-slate-50 text-petra-muted text-sm">טוען לקוחות...</div>
            ) : (
              <select
                className="input"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setDogId(""); }}
              >
                <option value="">בחר לקוח...</option>
                {customersWithPets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone} ({c.pets.length} כלבים)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dog */}
          {customerId && selectedCustomer && (
            <div>
              <label className="label">כלב *</label>
              <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                <option value="">בחר כלב...</option>
                {selectedCustomer.pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>{pet.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!customerId || !dogId || isPending}
            onClick={() => onSubmit(customerId, dogId)}
          >
            <Plus className="w-4 h-4" />
            {isPending ? "שומר..." : "שייך כלב"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROGRAM SETTINGS MODAL
// ═══════════════════════════════════════════════════════

function ProgramSettingsModal({
  program,
  onClose,
  onSubmit,
  isPending,
}: {
  program: TrainingProgram;
  onClose: () => void;
  onSubmit: (data: {
    startDate: string;
    endDate: string | null;
    location: string | null;
    frequency: string | null;
  }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    endDate: program.endDate ? new Date(program.endDate).toISOString().split('T')[0] : "",
    location: program.location || "",
    frequency: program.frequency || "",
  });

  const handleSubmit = () => {
    onSubmit({
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      location: form.location || null,
      frequency: form.frequency || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-500" />
            הגדרות חבילה - {program.dog.name}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך התחלה *</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">יעד סיום משוער</label>
              <input
                type="date"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">תדירות מפגשים</label>
            <select
              className="input"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              <option value="">לא מוגדר</option>
              <option value="WEEKLY">אחת לשבוע</option>
              <option value="BIWEEKLY">אחת לשבועיים</option>
              <option value="CUSTOM">אחר</option>
            </select>
          </div>

          <div>
            <label className="label">כתובת (מיקום האימון)</label>
            <input
              type="text"
              className="input"
              placeholder="רחוב, עיר..."
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.startDate || isPending}
            onClick={handleSubmit}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? "שומר..." : "שמור הגדרות"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
