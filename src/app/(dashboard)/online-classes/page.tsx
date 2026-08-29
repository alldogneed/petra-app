"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  MonitorPlay,
  Video,
  BookOpen,
  UserCheck,
  Palette,
  BarChart3,
  MessageCircleQuestion,
  ExternalLink,
  Settings,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { PageTitle } from "@/components/ui/PageTitle";
import { TierGate } from "@/components/paywall/TierGate";
import { useAuth } from "@/providers/auth-provider";
import { LiveClassesTab } from "@/components/online-classes/LiveClassesTab";
import { CoursesTab } from "@/components/online-classes/CoursesTab";
import { MembershipsTab } from "@/components/online-classes/MembershipsTab";
import { BrandingTab } from "@/components/online-classes/BrandingTab";
import { ReportsTab } from "@/components/online-classes/ReportsTab";
import { QuestionsTab } from "@/components/online-classes/QuestionsTab";
import {
  unwrapList,
  type OnlineClassItem,
  type CourseItem,
  type MembershipItem,
} from "@/components/online-classes/shared";

type TabId = "classes" | "courses" | "memberships" | "reports" | "questions" | "branding";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "classes", label: "שיעורים חיים", icon: <Video className="w-4 h-4" /> },
  { id: "courses", label: "קורסים", icon: <BookOpen className="w-4 h-4" /> },
  { id: "memberships", label: "מנויים", icon: <UserCheck className="w-4 h-4" /> },
  { id: "reports", label: "התקדמות", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "questions", label: "שאלות", icon: <MessageCircleQuestion className="w-4 h-4" /> },
  { id: "branding", label: "מיתוג", icon: <Palette className="w-4 h-4" /> },
];

export default function OnlineClassesPage() {
  return (
    <>
      <PageTitle title="שיעורים אונליין" />
      <TierGate
        feature="online_classes"
        title="שיעורים אונליין"
        description="פורטל חברים ממותג עם שיעורים חיים בזום וקורסים מוקלטים"
      >
        <OnlineClassesContent />
      </TierGate>
    </>
  );
}

function OnlineClassesContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("classes");
  const slug = user?.businessSlug || null;

  // Stats queries — share query keys with the tabs so React Query dedupes.
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["oc-classes"],
    queryFn: () => fetchJSON("/api/online-classes/classes"),
  });
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["oc-courses"],
    queryFn: () => fetchJSON("/api/online-classes/courses"),
  });
  const { data: membershipsData, isLoading: membershipsLoading } = useQuery({
    queryKey: ["oc-memberships", ""],
    queryFn: () => fetchJSON("/api/online-classes/memberships"),
  });

  const classes = unwrapList<OnlineClassItem>(classesData, "classes", "items");
  const courses = unwrapList<CourseItem>(coursesData, "courses", "items");
  const memberships = unwrapList<MembershipItem>(membershipsData, "memberships", "items");

  const upcomingClasses = classes.filter(
    (c) => new Date(c.startsAt).getTime() >= Date.now()
  ).length;
  const publishedCourses = courses.filter(
    (c) => c.status?.toLowerCase() === "published"
  ).length;
  const activeMembers = memberships.filter(
    (m) => m.status?.toLowerCase() === "active"
  ).length;
  const pendingMembers = memberships.filter(
    (m) => m.status?.toLowerCase() === "pending"
  ).length;

  const statsLoading = classesLoading || coursesLoading || membershipsLoading;

  const stats = [
    {
      label: "שיעורים קרובים",
      value: upcomingClasses,
      color: "bg-orange-50 text-orange-600",
      iconBg: "bg-orange-100",
      icon: <Video className="w-5 h-5" />,
    },
    {
      label: "קורסים שפורסמו",
      value: publishedCourses,
      color: "bg-blue-50 text-blue-600",
      iconBg: "bg-blue-100",
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      label: "מנויים פעילים",
      value: activeMembers,
      color: "bg-green-50 text-green-600",
      iconBg: "bg-green-100",
      icon: <UserCheck className="w-5 h-5" />,
    },
    {
      label: "ממתינים לאישור",
      value: pendingMembers,
      color: "bg-amber-50 text-amber-600",
      iconBg: "bg-amber-100",
      icon: <UserCheck className="w-5 h-5" />,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <MonitorPlay className="w-5 h-5 text-brand-500" />
        </div>
        <h1 className="page-title">שיעורים אונליין</h1>
        <div className="flex items-center gap-2 ms-auto">
          {slug ? (
            <a
              href={`/c/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              צפה בפורטל
            </a>
          ) : (
            <Link href="/settings" className="btn-secondary text-sm" title="הגדר כתובת (slug) לעסק בהגדרות כדי לפתוח את הפורטל">
              <Settings className="w-4 h-4" />
              הגדר כתובת לפורטל
            </Link>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className={cn("card p-4 flex items-center gap-3", stat.color)}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.iconBg)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold">{statsLoading ? "..." : stat.value}</p>
              <p className="text-xs opacity-75">{stat.label}</p>
            </div>
          </div>
        ))}
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
            {tab.id === "memberships" && pendingMembers > 0 && (
              <span
                className={cn(
                  "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                  activeTab === tab.id ? "bg-white text-brand-600" : "bg-amber-400 text-white"
                )}
              >
                {pendingMembers}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "classes" && <LiveClassesTab />}
      {activeTab === "courses" && <CoursesTab />}
      {activeTab === "memberships" && <MembershipsTab />}
      {activeTab === "reports" && <ReportsTab />}
      {activeTab === "questions" && <QuestionsTab />}
      {activeTab === "branding" && <BrandingTab businessName={user?.businessName} />}
    </div>
  );
}
