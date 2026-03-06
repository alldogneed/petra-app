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
  Shield,
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

interface TrainingPackage {
  id: string;
  name: string;
  description: string | null;
  type: string; // HOME | BOARDING | GROUP | WORKSHOP
  sessions: number;
  durationDays: number | null;
  price: number;
  isActive: boolean;
  _count: { programs: number };
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
  trainingType: string;
  packageId: string | null;
  workPlan: string | null;
  behaviorBaseline: string | null;
  customerExpectations: string | null;
  boardingStayId: string | null;
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
  practiceItems: string | null;
  nextSessionGoals: string | null;
  homeworkForCustomer: string | null;
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
  lastSessionDate?: string;
  daysSinceLastSession?: number;
  sessionsRemaining?: number;
}

// ─── Constants ───────────────────────────────────────

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type TabId = "overview" | "individual" | "boarding" | "groups" | "service-dogs";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "סקירה", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "individual", label: "אילוף בבית הלקוח", icon: <Dog className="w-4 h-4" /> },
  { id: "boarding", label: "אילוף בתנאי פנסיון", icon: <Hotel className="w-4 h-4" /> },
  { id: "groups", label: "אילוף קבוצתי", icon: <Users className="w-4 h-4" /> },
  { id: "service-dogs", label: "כלבי שירות", icon: <Shield className="w-4 h-4" /> },
];

const TYPE_BADGE: Record<TrainingType, { label: string; bg: string; text: string }> = {
  individual: { label: "אילוף בבית הלקוח", bg: "bg-blue-100", text: "text-blue-700" },
  boarding: { label: "פנסיון", bg: "bg-green-100", text: "text-green-700" },
  group: { label: "קבוצה", bg: "bg-purple-100", text: "text-purple-700" },
  workshop: { label: "סדנה", bg: "bg-pink-100", text: "text-pink-700" },
};

const PROGRAM_TYPES_MAP: Record<string, string> = {
  BASIC_OBEDIENCE: "משמעת בסיסית",
  REACTIVITY: "תגובתיות",
  PUPPY: "גורים",
  BEHAVIOR: "בעיות התנהגות",
  ADVANCED: "משמעת מתקדמת",
  CUSTOM: "מותאם אישית",
};

const GROUP_TYPES_MAP: Record<string, string> = {
  PUPPY_CLASS: "כיתת גורים",
  REACTIVITY: "תגובתיות",
  OBEDIENCE: "משמעת",
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
  onSubmit: (summary: string, sessionDate: string, rating: number | null, practiceItems: string, nextSessionGoals: string, homeworkForCustomer: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [summary, setSummary] = useState("");
  const [sessionDate, setSessionDate] = useState(today);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [practiceItems, setPracticeItems] = useState("");
  const [nextSessionGoals, setNextSessionGoals] = useState("");
  const [homeworkForCustomer, setHomeworkForCustomer] = useState("");

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תרגילים שבוצעו</label>
              <textarea className="input" rows={3} placeholder="אילו תרגילים עשיתם היום..." value={practiceItems} onChange={(e) => setPracticeItems(e.target.value)} />
            </div>
            <div>
              <label className="label">יעדים לפגישה הבאה</label>
              <textarea className="input" rows={3} placeholder="מה תעבדו בפגישה הבאה..." value={nextSessionGoals} onChange={(e) => setNextSessionGoals(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">שיעורי בית ללקוח</label>
            <textarea className="input" rows={2} placeholder="תרגול לבית..." value={homeworkForCustomer} onChange={(e) => setHomeworkForCustomer(e.target.value)} />
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
            onClick={() => onSubmit(summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer)}
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
  const [individualSubTab, setIndividualSubTab] = useState<"private" | "package" | "boarding-alt">("private");
  const [groupSubTab, setGroupSubTab] = useState<"groups" | "workshops">("groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSellPackage, setShowSellPackage] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewWorkshop, setShowNewWorkshop] = useState(false);
  const [showAssignDog, setShowAssignDog] = useState<{ groupId: string; groupName: string } | null>(null);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sessionLogTarget, setSessionLogTarget] = useState<{ programId: string; sessionNumber: number; dogName: string } | null>(null);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TrainingPackage | null>(null);
  const [showBoardingTraining, setShowBoardingTraining] = useState<{ stay: BoardingStay } | null>(null);
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

  const { data: packagesData, refetch: refetchPackages } = useQuery<{ packages: TrainingPackage[] }>({
    queryKey: ["training-packages"],
    queryFn: () => fetchJSON<{ packages: TrainingPackage[] }>("/api/training-packages?includeInactive=true"),
  });
  const packages = packagesData?.packages ?? [];

  const { data: boardingPrograms = [] } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-boarding"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?trainingType=BOARDING"),
  });

  const { data: serviceDogPrograms = [] } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-service"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?trainingType=SERVICE_DOG"),
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
      const sortedSessions = [...p.sessions].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
      const lastSession = sortedSessions[0];
      const daysSince = lastSession
        ? Math.floor((Date.now() - new Date(lastSession.sessionDate).getTime()) / 86400000)
        : undefined;
      const remaining = p.totalSessions ? p.totalSessions - usedSessions : undefined;
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
        lastSessionDate: lastSession?.sessionDate,
        daysSinceLastSession: daysSince,
        sessionsRemaining: remaining,
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
    mutationFn: async ({ programId, sessionNumber, summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer }: { programId: string; sessionNumber: number; summary?: string; sessionDate?: string; rating?: number | null; practiceItems?: string; nextSessionGoals?: string; homeworkForCustomer?: string }) => {
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
          ...(practiceItems ? { practiceItems } : {}),
          ...(nextSessionGoals ? { nextSessionGoals } : {}),
          ...(homeworkForCustomer ? { homeworkForCustomer } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      setSessionLogTarget(null);
    },
    onError: () => { setSessionLogTarget(null); toast.error("שגיאה בשמירת המפגש. נסה שוב."); },
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
    onError: () => toast.error("שגיאה ביצירת הקבוצה. נסה שוב."),
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
    onError: (err: Error) => toast.error(err.message || "שגיאה בהוספת כלב לקבוצה"),
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
    onError: () => toast.error("שגיאה בהסרת הכלב מהקבוצה"),
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
    onError: () => toast.error("שגיאה ביצירת תוכנית אימון. נסה שוב."),
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/training-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-packages"] });
      setShowCreatePackage(false);
      toast.success("חבילה נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת חבילה"),
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/training-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-packages"] });
      setEditingPackage(null);
      toast.success("חבילה עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון חבילה"),
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/training-packages/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-packages"] });
      toast.success("חבילה נמחקה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת חבילה"),
  });

  const createBoardingTrainingMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      setShowBoardingTraining(null);
      toast.success("תוכנית אילוף נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת תוכנית אילוף"),
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
    onError: () => { setEditingProgram(null); toast.error("שגיאה בעדכון הגדרות התוכנית. נסה שוב."); },
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
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-hide">
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
            <div>
              {/* Sub-tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 overflow-x-auto scrollbar-hide">
                {[
                  { id: "private" as const, label: "אילוף פרטני" },
                  { id: "package" as const, label: "חבילת אילוף" },
                  { id: "boarding-alt" as const, label: "חלופות פנסיון בבית הלקוח" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setIndividualSubTab(sub.id)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      individualSubTab === sub.id
                        ? "bg-white shadow-sm text-petra-text"
                        : "text-petra-muted hover:bg-white/60"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* אילוף פרטני */}
              {individualSubTab === "private" && (
                <IndividualTab
                  programs={programs.filter((p) => !p.packageId && !p.boardingStayId)}
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

              {/* חבילת אילוף */}
              {individualSubTab === "package" && (
                <div className="space-y-6">
                  <IndividualTab
                    programs={programs.filter((p) => p.packageId !== null)}
                    searchQuery={searchQuery}
                    expandedCards={expandedCards}
                    toggleExpand={toggleExpand}
                    onMarkAttendance={(programId, sessionNumber, dogName) =>
                      setSessionLogTarget({ programId, sessionNumber, dogName })
                    }
                    onEditSettings={(program) => setEditingProgram(program)}
                    isMarkingAttendance={markAttendanceMutation.isPending}
                  />
                  {/* Package catalog — manage packages */}
                  <div>
                    <h3 className="text-sm font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      ניהול חבילות אילוף
                    </h3>
                    <PackagesTab
                      packages={packages}
                      onCreatePackage={() => setShowCreatePackage(true)}
                      onEditPackage={setEditingPackage}
                      onDeletePackage={(id) => deletePackageMutation.mutate(id)}
                      onToggleActive={(pkg) => updatePackageMutation.mutate({ id: pkg.id, isActive: !pkg.isActive })}
                      isDeleting={deletePackageMutation.isPending}
                    />
                  </div>
                </div>
              )}

              {/* חלופות פנסיון בבית הלקוח */}
              {individualSubTab === "boarding-alt" && (
                <IndividualTab
                  programs={programs.filter((p) => p.boardingStayId !== null)}
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
            </div>
          )}

          {/* ═══ BOARDING TAB ═══ */}
          {activeTab === "boarding" && (
            <BoardingTrainingTab
              stays={activeStays}
              boardingPrograms={boardingPrograms}
              searchQuery={searchQuery}
              onAddTraining={(stay) => setShowBoardingTraining({ stay })}
              onLogSession={(programId, sessionNumber, dogName) =>
                setSessionLogTarget({ programId, sessionNumber, dogName })
              }
            />
          )}

          {/* ═══ GROUPS TAB (אילוף קבוצתי) ═══ */}
          {activeTab === "groups" && (
            <div>
              {/* Sub-tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 overflow-x-auto scrollbar-hide">
                {[
                  { id: "groups" as const, label: "קבוצות אימון" },
                  { id: "workshops" as const, label: "סדנאות מיוחדות" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setGroupSubTab(sub.id)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      groupSubTab === sub.id
                        ? "bg-white shadow-sm text-petra-text"
                        : "text-petra-muted hover:bg-white/60"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {groupSubTab === "groups" && (
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

              {groupSubTab === "workshops" && (
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
            </div>
          )}

          {/* ═══ SERVICE DOGS TAB ═══ */}
          {activeTab === "service-dogs" && (
            <div>
              {/* Header with link to service dogs management */}
              <div className="flex items-center justify-between mb-4 p-3 bg-brand-50 border border-brand-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-brand-500" />
                  <span className="text-sm font-medium text-brand-700">תוכניות אילוף לכלבי שירות</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-primary text-xs" onClick={() => setShowSellPackage(true)}>
                    <Plus className="w-3.5 h-3.5" /> תוכנית חדשה
                  </button>
                  <a href="/service-dogs" className="btn-secondary text-xs flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> ניהול כלבי שירות ←
                  </a>
                </div>
              </div>
              <IndividualTab
                programs={serviceDogPrograms}
                searchQuery={searchQuery}
                expandedCards={expandedCards}
                toggleExpand={toggleExpand}
                onMarkAttendance={(programId, sessionNumber, dogName) =>
                  setSessionLogTarget({ programId, sessionNumber, dogName })
                }
                onEditSettings={(program) => setEditingProgram(program)}
                isMarkingAttendance={markAttendanceMutation.isPending}
              />
            </div>
          )}

        </>
      )}

      {/* ═══ MODALS ═══ */}

      {showSellPackage && (
        <SellPackageModal
          onClose={() => setShowSellPackage(false)}
          onSubmit={(data) => createProgramMutation.mutate(data)}
          isPending={createProgramMutation.isPending}
          packages={packages.filter((p) => p.type === "HOME" && p.isActive)}
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
          onSubmit={(summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer) =>
            markAttendanceMutation.mutate({
              programId: sessionLogTarget.programId,
              sessionNumber: sessionLogTarget.sessionNumber,
              summary,
              sessionDate,
              rating,
              practiceItems,
              nextSessionGoals,
              homeworkForCustomer,
            })
          }
        />
      )}

      {showCreatePackage && (
        <CreatePackageModal
          onClose={() => setShowCreatePackage(false)}
          onSubmit={(data) => createPackageMutation.mutate(data)}
          isPending={createPackageMutation.isPending}
        />
      )}

      {editingPackage && (
        <EditPackageModal
          package={editingPackage}
          onClose={() => setEditingPackage(null)}
          onSubmit={(data) => updatePackageMutation.mutate({ id: editingPackage.id, ...data })}
          isPending={updatePackageMutation.isPending}
        />
      )}

      {showBoardingTraining && (
        <BoardingTrainingModal
          stay={showBoardingTraining.stay}
          boardingPackages={packages.filter((p) => p.type === "BOARDING" && p.isActive)}
          onClose={() => setShowBoardingTraining(null)}
          onSubmit={(data) => createBoardingTrainingMutation.mutate(data)}
          isPending={createBoardingTrainingMutation.isPending}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════

function DogStatusDot({ dog }: { dog: UnifiedDog }) {
  const isAlert = (dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE")
    || (dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE");
  const isCompleted = dog.status === "COMPLETED";
  if (isAlert) return <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />;
  if (isCompleted) return <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />;
}

function OverviewDogCard({ dog }: { dog: UnifiedDog }) {
  const badge = TYPE_BADGE[dog.type];
  const isLowSessions = dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE";
  const isOverdue = dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE";
  const isCompleted = dog.status === "COMPLETED";

  const whatsappUrl = dog.customerPhone
    ? `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(dog.customerPhone)}&text=${encodeURIComponent(`שלום! עדכון אימון עבור ${dog.dogName} 🐾`)}`
    : null;

  return (
    <div className={cn(
      "card p-4 transition-all",
      isLowSessions || isOverdue ? "border-red-200 bg-red-50/30" : isCompleted ? "opacity-70" : ""
    )}>
      {/* Top row */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
          isCompleted ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand-600"
        )}>
          {dog.dogName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <DogStatusDot dog={dog} />
            <h3 className="text-sm font-semibold text-petra-text truncate">{dog.dogName}</h3>
          </div>
          <p className="text-xs text-petra-muted truncate">{dog.customerName}</p>
        </div>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </div>

      {/* Detail */}
      <p className="text-xs text-petra-muted mb-3">{dog.detail}</p>

      {/* Progress bar */}
      {dog.progress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-petra-muted mb-1">
            <span>מפגשים</span>
            <span className="font-semibold">{dog.progress.used}/{dog.progress.total}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", isLowSessions ? "bg-red-400" : "bg-emerald-500")}
              style={{ width: `${Math.min(100, (dog.progress.used / dog.progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Alert tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {isLowSessions && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {dog.sessionsRemaining} מפגשים נותרו
          </span>
        )}
        {isOverdue && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {dog.daysSinceLastSession} ימים ללא מפגש
          </span>
        )}
        {isCompleted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> הושלם
          </span>
        )}
        {dog.lastSessionDate && !isCompleted && !isOverdue && (
          <span className="text-[10px] text-petra-muted">
            מפגש אחרון: {formatDate(dog.lastSessionDate)}
          </span>
        )}
      </div>

      {/* WhatsApp */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-green-700 hover:text-green-800 font-medium bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors w-full justify-center border border-green-200"
          onClick={(e) => e.stopPropagation()}
        >
          <Send className="w-3 h-3" />
          שלח עדכון לבעלים
        </a>
      )}
    </div>
  );
}

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

  const attention = dogs.filter((d) =>
    (d.sessionsRemaining !== undefined && d.sessionsRemaining <= 2 && d.status === "ACTIVE") ||
    (d.daysSinceLastSession !== undefined && d.daysSinceLastSession >= 14 && d.status === "ACTIVE")
  );
  const active = dogs.filter((d) => d.status === "ACTIVE" && !attention.some((a) => a.key === d.key));
  const completed = dogs.filter((d) => d.status === "COMPLETED");

  return (
    <div className="space-y-6">
      {attention.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            דורשים תשומת לב ({attention.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attention.map((dog) => <OverviewDogCard key={dog.key} dog={dog} />)}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            באימון פעיל ({active.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((dog) => <OverviewDogCard key={dog.key} dog={dog} />)}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            הושלמו ({completed.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completed.map((dog) => <OverviewDogCard key={dog.key} dog={dog} />)}
          </div>
        </section>
      )}
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
              href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(program.customer.phone)}&text=${encodeURIComponent(lines.join("\n"))}`}
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
// SESSION CHECKLIST COMPONENT
// ═══════════════════════════════════════════════════════

function SessionChecklist({
  program,
  usedSessions,
  onAddSession,
  isAdding,
}: {
  program: TrainingProgram;
  usedSessions: number;
  onAddSession: () => void;
  isAdding: boolean;
}) {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const total = program.totalSessions;
  const sessionsByNumber = new Map(program.sessions.map((s) => [s.sessionNumber ?? 0, s]));

  return (
    <div className="mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-petra-muted flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {total ? `מפגשים (${usedSessions}/${total})` : `מפגשים (${usedSessions})`}
        </h4>
        {total && (
          <span className="text-[11px] text-petra-muted">
            {total - usedSessions > 0 ? `נותרו ${total - usedSessions}` : "הכל הושלם ✓"}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total && total > 0 && (
        <div className="w-full h-1.5 rounded-full bg-slate-100 mb-3">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, (usedSessions / total) * 100)}%` }}
          />
        </div>
      )}

      {/* Session rows */}
      <div className="space-y-1.5">
        {/* Render planned slots */}
        {total ? Array.from({ length: total }, (_, i) => {
          const num = i + 1;
          const session = sessionsByNumber.get(num);
          const isCompleted = session?.status === "COMPLETED";
          const isNext = num === usedSessions + 1 && program.status === "ACTIVE";
          const expanded = expandedSessionId === session?.id;

          return (
            <div key={num}>
              <div
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all",
                  isCompleted
                    ? "bg-emerald-50 border-emerald-100 cursor-pointer hover:bg-emerald-100"
                    : isNext
                      ? "bg-brand-50 border-brand-200"
                      : "bg-slate-50 border-transparent opacity-50"
                )}
                onClick={() => isCompleted && session && setExpandedSessionId(expanded ? null : session.id)}
              >
                {/* Checkmark / number */}
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                  isCompleted ? "bg-emerald-500 text-white" : isNext ? "bg-brand-100 text-brand-600" : "bg-slate-200 text-slate-400"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : num}
                </div>

                <span className="text-xs font-medium text-petra-text flex-1">מפגש {num}</span>

                {isCompleted && session && (
                  <>
                    <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDate)}</span>
                    {session.rating && (
                      <span className="text-[10px] text-amber-500">{"★".repeat(session.rating)}</span>
                    )}
                    <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", expanded && "rotate-180")} />
                  </>
                )}

                {isNext && (
                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={(e) => { e.stopPropagation(); onAddSession(); }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    הוסף
                  </button>
                )}
              </div>

              {/* Expanded session details */}
              {expanded && session && (
                <div className="mx-3 mt-0.5 mb-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1.5">
                  {session.practiceItems && (
                    <div><span className="font-semibold text-petra-muted">תרגילים: </span>{session.practiceItems}</div>
                  )}
                  {session.nextSessionGoals && (
                    <div><span className="font-semibold text-petra-muted">יעדים הבאים: </span>{session.nextSessionGoals}</div>
                  )}
                  {session.homeworkForCustomer && (
                    <div><span className="font-semibold text-petra-muted">שיעורי בית: </span>{session.homeworkForCustomer}</div>
                  )}
                  {session.summary && (
                    <div><span className="font-semibold text-petra-muted">סיכום: </span>{session.summary}</div>
                  )}
                </div>
              )}
            </div>
          );
        }) : (
          /* No totalSessions - just show completed + add button */
          <>
            {program.sessions.map((session) => {
              const expanded = expandedSessionId === session.id;
              return (
                <div key={session.id}>
                  <div
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-all"
                    onClick={() => setExpandedSessionId(expanded ? null : session.id)}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-petra-text flex-1">מפגש {session.sessionNumber || ""}</span>
                    <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDate)}</span>
                    {session.rating && <span className="text-[10px] text-amber-500">{"★".repeat(session.rating)}</span>}
                    <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", expanded && "rotate-180")} />
                  </div>
                  {expanded && (
                    <div className="mx-3 mt-0.5 mb-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1.5">
                      {session.practiceItems && <div><span className="font-semibold text-petra-muted">תרגילים: </span>{session.practiceItems}</div>}
                      {session.nextSessionGoals && <div><span className="font-semibold text-petra-muted">יעדים הבאים: </span>{session.nextSessionGoals}</div>}
                      {session.homeworkForCustomer && <div><span className="font-semibold text-petra-muted">שיעורי בית: </span>{session.homeworkForCustomer}</div>}
                      {session.summary && <div><span className="font-semibold text-petra-muted">סיכום: </span>{session.summary}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom "add session" button */}
      {program.status === "ACTIVE" && (
        <button
          type="button"
          disabled={isAdding}
          onClick={onAddSession}
          className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-brand-200 text-xs font-semibold text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          מפגש בבית הלקוח +
        </button>
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
                            return `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(program.customer.phone)}&text=${encodeURIComponent(lines.join("\n"))}`;
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
                            return `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(program.customer.phone)}&text=${encodeURIComponent(lines.join("\n"))}`;
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

                    {/* Session checklist */}
                    <SessionChecklist
                      program={program}
                      usedSessions={usedSessions}
                      onAddSession={() => onMarkAttendance(program.id, usedSessions + 1, program.dog.name)}
                      isAdding={isMarkingAttendance}
                    />

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
// BOARDING TRAINING TAB
// ═══════════════════════════════════════════════════════

function BoardingTrainingTab({
  stays,
  boardingPrograms,
  searchQuery,
  onAddTraining,
  onLogSession,
}: {
  stays: BoardingStay[];
  boardingPrograms: TrainingProgram[];
  searchQuery: string;
  onAddTraining: (stay: BoardingStay) => void;
  onLogSession: (programId: string, sessionNumber: number, dogName: string) => void;
}) {
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
        <h3 className="text-base font-semibold text-petra-text mb-1">אין לינות פעילות</h3>
        <p className="text-sm text-petra-muted">לינות פעילות עם תוכניות אילוף יופיעו כאן</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((stay) => {
        const linkedProgram = boardingPrograms.find((p) => p.boardingStayId === stay.id);
        const daysRemaining = stay.checkOut
          ? Math.ceil((new Date(stay.checkOut).getTime() - Date.now()) / 86400000)
          : null;
        const usedSessions = linkedProgram?.sessions?.filter((s) => s.status === "COMPLETED").length ?? 0;
        const nextSessionNum = usedSessions + 1;

        return (
          <div key={stay.id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Hotel className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-petra-text">{stay.pet.name}</h3>
                  {linkedProgram ? (
                    linkedProgram.startDate && linkedProgram.endDate ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> לקוח פעיל
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">בהגדרה — חסרים תאריכים</span>
                    )
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">ללא תוכנית אילוף</span>
                  )}
                </div>
                <p className="text-xs text-petra-muted">{stay.customer.name} • {stay.room?.name ?? "ללא חדר"}</p>
              </div>
              {daysRemaining !== null && (
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-lg",
                  daysRemaining <= 1 ? "bg-red-100 text-red-700" :
                  daysRemaining <= 3 ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-600"
                )}>
                  {Math.max(0, daysRemaining)} ימים
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-petra-muted mb-3">
              <Calendar className="w-3.5 h-3.5" />
              <span>כניסה: {formatDate(stay.checkIn)}</span>
              {stay.checkOut && <><span>•</span><span>יציאה: {formatDate(stay.checkOut)}</span></>}
            </div>

            {linkedProgram ? (
              <div className="border-t pt-3 space-y-3">
                {/* Program dates */}
                {(linkedProgram.startDate || linkedProgram.endDate) && (
                  <div className="flex items-center gap-3 text-xs text-petra-muted bg-slate-50 px-3 py-2 rounded-xl">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    {linkedProgram.startDate && <span>התחלה: {formatDate(linkedProgram.startDate)}</span>}
                    {linkedProgram.startDate && linkedProgram.endDate && <span>•</span>}
                    {linkedProgram.endDate && <span>סיום: {formatDate(linkedProgram.endDate)}</span>}
                  </div>
                )}
                {linkedProgram.behaviorBaseline && (
                  <div className="p-2 rounded-lg bg-blue-50">
                    <p className="text-[10px] font-semibold text-blue-600 mb-1">בסיס התנהגותי</p>
                    <p className="text-xs text-petra-text">{linkedProgram.behaviorBaseline}</p>
                  </div>
                )}
                {linkedProgram.customerExpectations && (
                  <div className="p-2 rounded-lg bg-purple-50">
                    <p className="text-[10px] font-semibold text-purple-600 mb-1">ציפיות הלקוח</p>
                    <p className="text-xs text-petra-text">{linkedProgram.customerExpectations}</p>
                  </div>
                )}
                {linkedProgram.workPlan && (
                  <div className="p-2 rounded-lg bg-amber-50">
                    <p className="text-[10px] font-semibold text-amber-600 mb-1">תוכנית עבודה שבועית — גלוי לצוות</p>
                    <p className="text-xs text-petra-text whitespace-pre-line">{linkedProgram.workPlan}</p>
                  </div>
                )}
                {linkedProgram.sessions && linkedProgram.sessions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-petra-muted mb-1.5">עדכוני התקדמות ({usedSessions} מפגשים)</p>
                    <div className="space-y-1.5">
                      {linkedProgram.sessions.slice(0, 3).map((s) => (
                        <div key={s.id} className="p-2 rounded-lg bg-slate-50 text-xs">
                          <span className="font-medium text-petra-text">{formatDate(s.sessionDate)}</span>
                          {s.summary && <p className="text-petra-muted mt-0.5">{s.summary}</p>}
                          {s.practiceItems && <p className="text-blue-600 mt-0.5">תרגילים: {s.practiceItems}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  className="btn-secondary text-xs w-full"
                  onClick={() => onLogSession(linkedProgram.id, nextSessionNum, stay.pet.name)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף עדכון אילוף
                </button>
              </div>
            ) : (
              <button
                className="btn-primary text-xs w-full"
                onClick={() => onAddTraining(stay)}
              >
                <Plus className="w-3.5 h-3.5" />
                הוסף תוכנית אילוף
              </button>
            )}
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
                      window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${msg}`, "_blank");
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
                            className="ms-auto text-[10px] text-brand-600 hover:text-brand-700 font-medium"
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
                                  "text-[10px] ms-auto",
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
  packages = [],
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  packages?: TrainingPackage[];
}) {
  const [step, setStep] = useState(packages.length > 0 ? 1 : 2);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
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
  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const autoName = selectedDog
    ? selectedPkg
      ? `${selectedPkg.name} - ${selectedDog.name}`
      : `אילוף ${PROGRAM_TYPES_MAP[programType] || programType} - ${selectedDog.name}`
    : "";

  const handleSelectPackage = (pkg: TrainingPackage | null) => {
    if (pkg) {
      setSelectedPackageId(pkg.id);
      setTotalSessions(String(pkg.sessions));
      setPrice(String(pkg.price));
    } else {
      setSelectedPackageId(null);
    }
    setStep(2);
  };

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
      packageId: selectedPackageId || null,
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

        {step === 1 && packages.length > 0 && (
          <div>
            <p className="text-sm text-petra-muted mb-4">בחר חבילת אילוף:</p>
            <div className="space-y-2 mb-4">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  className={cn(
                    "w-full text-right p-3 rounded-xl border-2 transition-all",
                    selectedPackageId === pkg.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-petra-border bg-white hover:border-brand-200"
                  )}
                  onClick={() => setSelectedPackageId(pkg.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-petra-text">{pkg.name}</span>
                    <span className="text-sm font-bold text-brand-600">{formatCurrency(pkg.price)}</span>
                  </div>
                  <p className="text-xs text-petra-muted mt-0.5">{pkg.sessions} מפגשים</p>
                  {pkg.description && <p className="text-xs text-petra-muted mt-0.5 line-clamp-1">{pkg.description}</p>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1"
                disabled={!selectedPackageId}
                onClick={() => handleSelectPackage(packages.find((p) => p.id === selectedPackageId) ?? null)}
              >
                המשך
              </button>
              <button className="btn-secondary" onClick={() => handleSelectPackage(null)}>
                ללא חבילה
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            {selectedPkg && (
              <div className="p-3 mb-4 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700 flex items-center justify-between">
                <span>{selectedPkg.name} — {selectedPkg.sessions} מפגשים</span>
                {packages.length > 0 && (
                  <button className="text-xs text-brand-500 hover:underline" onClick={() => setStep(1)}>שנה</button>
                )}
              </div>
            )}

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
              {!selectedPkg && (
                <div>
                  <label className="label">סוג תוכנית</label>
                  <select className="input" value={programType} onChange={(e) => setProgramType(e.target.value)}>
                    {Object.entries(PROGRAM_TYPES_MAP).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}

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
          </>
        )}
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

// ═══════════════════════════════════════════════════════
// SERVICE DOGS TRAINING TAB
// ═══════════════════════════════════════════════════════

function ServiceDogsTrainingTab({
  programs,
  searchQuery,
  onNewProgram,
}: {
  programs: TrainingProgram[];
  searchQuery: string;
  onNewProgram: () => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter(
      (p) => p.dog.name.toLowerCase().includes(q) || p.customer.name.toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} תוכניות כלבי שירות</p>
        <button className="btn-primary text-sm" onClick={onNewProgram}>
          <Plus className="w-4 h-4" />
          תוכנית חדשה
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Shield className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תוכניות אילוף לכלבי שירות</h3>
          <p className="text-sm text-petra-muted">
            <a href="/service-dogs" className="text-brand-600 hover:underline">עבור לניהול כלבי שירות</a>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
            const statusInfo = PROGRAM_STATUS_MAP[p.status] || PROGRAM_STATUS_MAP.ACTIVE;
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-petra-text truncate">{p.dog.name}</h3>
                    <p className="text-xs text-petra-muted truncate">{p.customer.name}</p>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>
                {p.totalSessions && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-petra-muted mb-1">
                      <span>מפגשים</span>
                      <span>{usedSessions}/{p.totalSessions}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (usedSessions / p.totalSessions) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <a
                  href={`/service-dogs/${p.dog.id}`}
                  className="text-xs text-brand-600 hover:underline mt-1 block"
                >
                  צפה בפרופיל כלב שירות ←
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PACKAGES TAB
// ═══════════════════════════════════════════════════════

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  HOME: "אילוף בבית",
  BOARDING: "אילוף בפנסיון",
  GROUP: "קבוצה",
  WORKSHOP: "סדנה",
};

const PACKAGE_TYPE_COLORS: Record<string, string> = {
  HOME: "bg-blue-100 text-blue-700",
  BOARDING: "bg-orange-100 text-orange-700",
  GROUP: "bg-green-100 text-green-700",
  WORKSHOP: "bg-purple-100 text-purple-700",
};

function PackagesTab({
  packages,
  onCreatePackage,
  onEditPackage,
  onDeletePackage,
  onToggleActive,
  isDeleting,
}: {
  packages: TrainingPackage[];
  onCreatePackage: () => void;
  onEditPackage: (pkg: TrainingPackage) => void;
  onDeletePackage: (id: string) => void;
  onToggleActive: (pkg: TrainingPackage) => void;
  isDeleting: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{packages.length} חבילות</p>
        <button className="btn-primary text-sm" onClick={onCreatePackage}>
          <Plus className="w-4 h-4" />
          חבילה חדשה
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Package className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין חבילות אילוף</h3>
          <p className="text-sm text-petra-muted">הגדר חבילות אילוף כדי למכור ללקוחות בקלות</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className={cn("card p-4", !pkg.isActive && "opacity-60")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-petra-text mb-1">{pkg.name}</h3>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", PACKAGE_TYPE_COLORS[pkg.type] || "bg-slate-100 text-slate-600")}>
                    {PACKAGE_TYPE_LABELS[pkg.type] || pkg.type}
                  </span>
                </div>
                <div className="flex gap-1 mr-2 flex-shrink-0">
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
                    onClick={() => onEditPackage(pkg)}
                    title="עריכה"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {pkg._count.programs === 0 ? (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500"
                      onClick={() => onDeletePackage(pkg.id)}
                      disabled={isDeleting}
                      title="מחק"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-bold text-petra-text">{formatCurrency(pkg.price)}</span>
                <span className="text-xs text-petra-muted">{pkg.sessions} מפגשים</span>
              </div>

              {pkg.durationDays && (
                <p className="text-xs text-petra-muted mb-2">{pkg.durationDays} ימי פנסיון</p>
              )}

              {pkg.description && (
                <p className="text-xs text-petra-muted mb-3 line-clamp-2">{pkg.description}</p>
              )}

              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="text-[10px] text-petra-muted">{pkg._count.programs} תוכניות פעילות</span>
                <button
                  onClick={() => onToggleActive(pkg)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
                    pkg.isActive
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {pkg.isActive ? "פעיל" : "לא פעיל"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE PACKAGE MODAL
// ═══════════════════════════════════════════════════════

function CreatePackageModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("HOME");
  const [sessions, setSessions] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !sessions || !price) return;
    onSubmit({ name: name.trim(), type, sessions, durationDays: durationDays || undefined, price, description: description || undefined });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">חבילת אילוף חדשה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם החבילה *</label>
            <input className="input" placeholder='דוג׳ "5 מפגשי אילוף בסיסי"' value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">סוג</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOME">אילוף בבית</option>
              <option value="BOARDING">אילוף בפנסיון</option>
              <option value="GROUP">קבוצה</option>
              <option value="WORKSHOP">סדנה</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מספר מפגשים *</label>
              <input type="number" min={1} className="input" placeholder="5" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">מחיר (₪) *</label>
              <input type="number" min={0} className="input" placeholder="1500" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {type === "BOARDING" && (
            <div>
              <label className="label">ימי פנסיון</label>
              <input type="number" min={1} className="input" placeholder="14" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <textarea className="input" rows={2} placeholder="תיאור קצר..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !name.trim() || !sessions || !price} onClick={handleSubmit}>
            {isPending ? "יוצר..." : "צור חבילה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EDIT PACKAGE MODAL
// ═══════════════════════════════════════════════════════

function EditPackageModal({
  package: pkg,
  onClose,
  onSubmit,
  isPending,
}: {
  package: TrainingPackage;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(pkg.name);
  const [type, setType] = useState(pkg.type);
  const [sessions, setSessions] = useState(String(pkg.sessions));
  const [durationDays, setDurationDays] = useState(pkg.durationDays ? String(pkg.durationDays) : "");
  const [price, setPrice] = useState(String(pkg.price));
  const [description, setDescription] = useState(pkg.description ?? "");

  const handleSubmit = () => {
    if (!name.trim() || !sessions || !price) return;
    onSubmit({ name: name.trim(), type, sessions, durationDays: durationDays || null, price, description: description || null });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">עריכת חבילה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם החבילה *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">סוג</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOME">אילוף בבית</option>
              <option value="BOARDING">אילוף בפנסיון</option>
              <option value="GROUP">קבוצה</option>
              <option value="WORKSHOP">סדנה</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מספר מפגשים *</label>
              <input type="number" min={1} className="input" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">מחיר (₪) *</label>
              <input type="number" min={0} className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {type === "BOARDING" && (
            <div>
              <label className="label">ימי פנסיון</label>
              <input type="number" min={1} className="input" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">תיאור</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !name.trim() || !sessions || !price} onClick={handleSubmit}>
            {isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BOARDING TRAINING MODAL
// ═══════════════════════════════════════════════════════

function BoardingTrainingModal({
  stay,
  boardingPackages,
  onClose,
  onSubmit,
  isPending,
}: {
  stay: BoardingStay;
  boardingPackages: TrainingPackage[];
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const stayCheckIn = stay.checkIn ? new Date(stay.checkIn).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const stayCheckOut = stay.checkOut ? new Date(stay.checkOut).toISOString().slice(0, 10) : "";

  const [packageId, setPackageId] = useState("");
  const [startDate, setStartDate] = useState(stayCheckIn);
  const [endDate, setEndDate] = useState(stayCheckOut);
  const [behaviorBaseline, setBehaviorBaseline] = useState("");
  const [customerExpectations, setCustomerExpectations] = useState("");
  const [workPlan, setWorkPlan] = useState("");

  const selectedPkg = boardingPackages.find((p) => p.id === packageId);

  const handleSubmit = () => {
    onSubmit({
      dogId: stay.pet.id,
      customerId: stay.customer.id,
      boardingStayId: stay.id,
      trainingType: "BOARDING",
      name: `תוכנית אילוף — ${stay.pet.name}`,
      programType: "CUSTOM",
      packageId: packageId || null,
      totalSessions: selectedPkg?.sessions ?? null,
      price: selectedPkg?.price ?? null,
      startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      behaviorBaseline: behaviorBaseline || null,
      customerExpectations: customerExpectations || null,
      workPlan: workPlan || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">תוכנית אילוף לפנסיון — {stay.pet.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700 mb-4">
          {stay.pet.name} • {stay.customer.name} • {stay.room?.name ?? "ללא חדר"}
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">חבילת אילוף (אופציונלי)</label>
            <select className="input" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              <option value="">ללא חבילה</option>
              {boardingPackages.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.sessions} מפגשים, ₪{p.price}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">התחלת תוכנית *</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">סיום תוכנית *</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {(!startDate || !endDate) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              נדרשים תאריך התחלה וסיום כדי שהלקוח יסומן כ"לקוח פעיל"
            </p>
          )}
          <div>
            <label className="label">בסיס התנהגותי ראשוני</label>
            <textarea
              className="input"
              rows={3}
              placeholder="תאר את ההתנהגות הנוכחית של הכלב: רמת עצמאות, תגובות לגירויים, כישורים קיימים..."
              value={behaviorBaseline}
              onChange={(e) => setBehaviorBaseline(e.target.value)}
            />
          </div>
          <div>
            <label className="label">ציפיות הלקוח</label>
            <textarea
              className="input"
              rows={2}
              placeholder="מה הלקוח מצפה להשיג במהלך הפנסיון..."
              value={customerExpectations}
              onChange={(e) => setCustomerExpectations(e.target.value)}
            />
          </div>
          <div>
            <label className="label">תוכנית עבודה שבועית <span className="text-[10px] text-amber-600 font-normal">— גלוי לצוות</span></label>
            <textarea
              className="input"
              rows={4}
              placeholder="תאר את תוכנית האילוף היומית/שבועית לצוות הפנסיון..."
              value={workPlan}
              onChange={(e) => setWorkPlan(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !startDate || !endDate} onClick={handleSubmit}>
            {isPending ? "יוצר..." : "צור תוכנית אילוף"}
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
