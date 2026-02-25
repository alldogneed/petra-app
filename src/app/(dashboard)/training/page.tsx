"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  Star,
  CheckCircle2,
  Circle,
  Target,
  Dog,
  ClipboardList,
} from "lucide-react";
import { cn, formatDate, fetchJSON } from "@/lib/utils";

// --- Types ---
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
  attendance: Attendance[];
}

interface Attendance {
  id: string;
  attendanceStatus: string;
  participant: {
    dog: { name: string };
    customer: { name: string };
  };
}

interface TrainingProgram {
  id: string;
  name: string;
  programType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  totalSessions: number | null;
  notes: string | null;
  dog: { id: string; name: string; breed: string | null };
  customer: { id: string; name: string; phone: string };
  goals: TrainingGoal[];
  sessions: ProgramSession[];
  homework: Homework[];
  _count: { goals: number; sessions: number; homework: number };
}

interface TrainingGoal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progressPercent: number;
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

interface Homework {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  dueDate: string | null;
}

// --- Constants ---
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const GROUP_TYPES: Record<string, string> = {
  PUPPY_CLASS: "גורים",
  REACTIVITY: "תגובתיות",
  OBEDIENCE: "ציות",
  CUSTOM: "מותאם אישית",
};

const PROGRAM_TYPES: Record<string, string> = {
  BASIC_OBEDIENCE: "אילוף בסיסי",
  REACTIVITY: "תגובתיות",
  PUPPY: "גורים",
  BEHAVIOR: "בעיות התנהגות",
  ADVANCED: "מתקדם",
  CUSTOM: "מותאם אישית",
};

const PROGRAM_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "פעיל", color: "#22C55E" },
  PAUSED: { label: "מושהה", color: "#F59E0B" },
  COMPLETED: { label: "הושלם", color: "#3B82F6" },
  CANCELED: { label: "בוטל", color: "#EF4444" },
};

const GOAL_STATUS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "טרם התחיל", color: "#94A3B8" },
  IN_PROGRESS: { label: "בתהליך", color: "#F59E0B" },
  ACHIEVED: { label: "הושג", color: "#22C55E" },
  DROPPED: { label: "בוטל", color: "#EF4444" },
};

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "programs">("groups");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery<TrainingGroup[]>({
    queryKey: ["training-groups"],
    queryFn: () => fetchJSON<TrainingGroup[]>("/api/training-groups?active=true"),
    enabled: activeTab === "groups",
  });

  // Programs
  const { data: programs = [], isLoading: programsLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs"),
    enabled: activeTab === "programs",
  });

  const [groupForm, setGroupForm] = useState({
    name: "",
    groupType: "CUSTOM",
    location: "",
    defaultDayOfWeek: "",
    defaultTime: "",
    maxParticipants: "",
    notes: "",
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: typeof groupForm) =>
      fetch("/api/training-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          defaultDayOfWeek: data.defaultDayOfWeek ? parseInt(data.defaultDayOfWeek) : null,
          maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants) : null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowNewGroup(false);
      setGroupForm({ name: "", groupType: "CUSTOM", location: "", defaultDayOfWeek: "", defaultTime: "", maxParticipants: "", notes: "" });
    },
  });

  const isLoading = activeTab === "groups" ? groupsLoading : programsLoading;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">אימונים</h1>
        <p className="text-sm text-petra-muted">
          {activeTab === "groups"
            ? `${groups.length} קבוצות אימון`
            : `${programs.length} תוכניות אישיות`}
        </p>
        {activeTab === "groups" && (
          <button className="btn-primary" onClick={() => setShowNewGroup(true)}>
            <Plus className="w-4 h-4" />
            קבוצה חדשה
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6">
        <button
          onClick={() => setActiveTab("groups")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
            activeTab === "groups"
              ? "bg-brand-500 text-white"
              : "bg-slate-100 text-petra-muted hover:bg-slate-200"
          )}
        >
          <Users className="w-4 h-4" />
          קבוצות
        </button>
        <button
          onClick={() => setActiveTab("programs")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
            activeTab === "programs"
              ? "bg-brand-500 text-white"
              : "bg-slate-100 text-petra-muted hover:bg-slate-200"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          תוכניות אישיות
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : activeTab === "groups" ? (
        /* Groups Tab */
        groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <GraduationCap className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-petra-text mb-1">אין קבוצות אימון</h3>
            <p className="text-sm text-petra-muted mb-4">צור קבוצת אימון חדשה כדי להתחיל</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                expanded={expandedGroup === group.id}
                onToggle={() =>
                  setExpandedGroup(expandedGroup === group.id ? null : group.id)
                }
              />
            ))}
          </div>
        )
      ) : /* Programs Tab */
      programs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Target className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תוכניות אימון</h3>
          <p className="text-sm text-petra-muted mb-4">תוכניות אימון ייווצרו עבור כלבים ספציפיים</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              expanded={expandedProgram === program.id}
              onToggle={() =>
                setExpandedProgram(expandedProgram === program.id ? null : program.id)
              }
            />
          ))}
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowNewGroup(false)} />
          <div className="modal-content max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-petra-text">קבוצת אימון חדשה</h2>
              <button
                onClick={() => setShowNewGroup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">שם הקבוצה *</label>
                <input
                  className="input"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="למשל: קבוצת גורים - מחזור 3"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">סוג</label>
                  <select
                    className="input"
                    value={groupForm.groupType}
                    onChange={(e) => setGroupForm({ ...groupForm, groupType: e.target.value })}
                  >
                    {Object.entries(GROUP_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">מקסימום משתתפים</label>
                  <input
                    type="number"
                    className="input"
                    value={groupForm.maxParticipants}
                    onChange={(e) => setGroupForm({ ...groupForm, maxParticipants: e.target.value })}
                    placeholder="6"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">יום קבוע</label>
                  <select
                    className="input"
                    value={groupForm.defaultDayOfWeek}
                    onChange={(e) => setGroupForm({ ...groupForm, defaultDayOfWeek: e.target.value })}
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
                    value={groupForm.defaultTime}
                    onChange={(e) => setGroupForm({ ...groupForm, defaultTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">מיקום</label>
                <input
                  className="input"
                  value={groupForm.location}
                  onChange={(e) => setGroupForm({ ...groupForm, location: e.target.value })}
                  placeholder="גן ציבורי, מגרש אימונים..."
                />
              </div>
              <div>
                <label className="label">הערות</label>
                <textarea
                  className="input"
                  rows={2}
                  value={groupForm.notes}
                  onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1"
                disabled={!groupForm.name || createGroupMutation.isPending}
                onClick={() => createGroupMutation.mutate(groupForm)}
              >
                <Plus className="w-4 h-4" />
                {createGroupMutation.isPending ? "שומר..." : "צור קבוצה"}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewGroup(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Group Card Component ---
function GroupCard({
  group,
  expanded,
  onToggle,
}: {
  group: TrainingGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.1)" }}
        >
          <GraduationCap className="w-5 h-5 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-petra-text">{group.name}</h3>
            <span className="badge-neutral text-[10px]">
              {GROUP_TYPES[group.groupType] || group.groupType}
            </span>
            {!group.isActive && (
              <span className="badge-danger text-[10px]">לא פעיל</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-petra-muted">
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
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-petra-border">
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
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
                  >
                    <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center text-xs font-bold text-brand-600">
                      {p.dog.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-petra-text truncate">
                        {p.dog.name}
                        {p.dog.breed && (
                          <span className="text-petra-muted font-normal"> ({p.dog.breed})</span>
                        )}
                      </p>
                      <p className="text-[10px] text-petra-muted truncate">
                        {p.customer.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              מפגשים אחרונים ({group._count.sessions})
            </h4>
            {group.sessions.length === 0 ? (
              <p className="text-xs text-petra-muted">אין מפגשים</p>
            ) : (
              <div className="space-y-2">
                {group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-50"
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        session.status === "COMPLETED"
                          ? "bg-emerald-500"
                          : session.status === "CANCELED"
                          ? "bg-red-400"
                          : "bg-blue-400"
                      )}
                    />
                    <span className="text-xs text-petra-text">
                      מפגש {session.sessionNumber || ""}
                    </span>
                    <span className="text-[10px] text-petra-muted">
                      {formatDate(session.sessionDatetime)}
                    </span>
                    <span className="text-[10px] badge-neutral mr-auto">
                      {session.attendance.length} נוכחים
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Program Card Component ---
function ProgramCard({
  program,
  expanded,
  onToggle,
}: {
  program: TrainingProgram;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusInfo = PROGRAM_STATUS[program.status] || PROGRAM_STATUS.ACTIVE;
  const completedGoals = program.goals.filter((g) => g.status === "ACHIEVED").length;
  const avgProgress =
    program.goals.length > 0
      ? Math.round(
          program.goals.reduce((sum, g) => sum + g.progressPercent, 0) /
            program.goals.length
        )
      : 0;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(59,130,246,0.1)" }}
        >
          <Target className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-petra-text">{program.name}</h3>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: `${statusInfo.color}15`,
                color: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-petra-muted">
            <span className="flex items-center gap-1">
              <Dog className="w-3 h-3" />
              {program.dog.name}
            </span>
            <span>{program.customer.name}</span>
            <span className="badge-neutral text-[10px]">
              {PROGRAM_TYPES[program.programType] || program.programType}
            </span>
          </div>
        </div>

        {/* Progress circle */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-lg font-bold text-brand-500">{avgProgress}%</div>
          <span className="text-[9px] text-petra-muted">התקדמות</span>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-petra-border">
          {/* Goals */}
          <div className="p-4 border-b border-petra-border">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              יעדים ({completedGoals}/{program.goals.length} הושגו)
            </h4>
            {program.goals.length === 0 ? (
              <p className="text-xs text-petra-muted">לא הוגדרו יעדים</p>
            ) : (
              <div className="space-y-2.5">
                {program.goals.map((goal) => {
                  const goalStatus = GOAL_STATUS[goal.status] || GOAL_STATUS.IN_PROGRESS;
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-petra-text">
                          {goal.title}
                        </span>
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: goalStatus.color }}
                        >
                          {goalStatus.label} • {goal.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${goal.progressPercent}%`,
                            background: goalStatus.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="p-4 border-b border-petra-border">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              שיעורים ({program._count.sessions})
            </h4>
            {program.sessions.length === 0 ? (
              <p className="text-xs text-petra-muted">אין שיעורים</p>
            ) : (
              <div className="space-y-2">
                {program.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-50"
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        session.status === "COMPLETED"
                          ? "bg-emerald-500"
                          : session.status === "CANCELED"
                          ? "bg-red-400"
                          : "bg-blue-400"
                      )}
                    />
                    <span className="text-xs text-petra-text">
                      שיעור {session.sessionNumber || ""}
                    </span>
                    <span className="text-[10px] text-petra-muted">
                      {formatDate(session.sessionDate)}
                    </span>
                    {session.rating && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-500 mr-auto">
                        <Star className="w-3 h-3 fill-current" />
                        {session.rating}/5
                      </span>
                    )}
                    {session.summary && (
                      <span className="text-[10px] text-petra-muted truncate max-w-[120px] mr-auto">
                        {session.summary}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Homework */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              שיעורי בית ({program._count.homework})
            </h4>
            {program.homework.length === 0 ? (
              <p className="text-xs text-petra-muted">אין שיעורי בית</p>
            ) : (
              <div className="space-y-1.5">
                {program.homework.map((hw) => (
                  <div
                    key={hw.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
                  >
                    {hw.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs flex-1",
                        hw.isCompleted
                          ? "text-petra-muted line-through"
                          : "text-petra-text"
                      )}
                    >
                      {hw.title}
                    </span>
                    {hw.dueDate && (
                      <span className="text-[10px] text-petra-muted">
                        עד {formatDate(hw.dueDate)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
