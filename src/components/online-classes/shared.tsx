"use client";

import { X } from "lucide-react";

// ─── Types (per docs/online-classes/CONTRACTS.md) ───────────────

export interface OnlineClassItem {
  id: string;
  title: string;
  description: string | null;
  instructorName: string | null;
  startsAt: string;
  durationMin: number | null;
  capacity: number;
  spotsTaken: number;
  zoomLink: string | null;
  waitlistCount?: number;
  registeredCount?: number;
  _count?: { registrations?: number };
}

export interface ClassRegistration {
  id: string;
  status: string; // registered | waitlist | cancelled
  createdAt: string;
  portalUser: { name: string; phone: string; email: string };
}

export interface MembershipItem {
  id: string;
  status: string; // pending | active | expired | suspended
  validUntil: string | null;
  paymentNote: string | null;
  approvedAt: string | null;
  createdAt?: string;
  portalUser: { name: string; phone: string; email: string };
}

export interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: string; // draft | published
  moduleCount?: number;
  lessonCount?: number;
  _count?: { modules?: number; lessons?: number };
}

export interface LessonItem {
  id: string;
  title: string;
  type: string; // video | pdf | text
  description?: string | null;
  videoRef: string | null;
  fileUrl: string | null;
  textContent: string | null;
  durationMin: number | null;
  isFreePreview: boolean;
  position: number;
}

export interface CourseModuleItem {
  id: string;
  title: string;
  position: number;
  lessons: LessonItem[];
}

export interface CourseTree extends CourseItem {
  modules: CourseModuleItem[];
}

export interface BrandingData {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  senderName: string | null;
  paymentLinkUrl: string | null;
  aboutText: string | null;
}

// ─── Defensive response unwrapping ──────────────────────────────
// APIs are built in parallel — accept both bare arrays and enveloped objects.

export function unwrapList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }
  }
  return [];
}

export function unwrapObject<T>(data: unknown, ...keys: string[]): T {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) {
      if (obj[k] && typeof obj[k] === "object") return obj[k] as T;
    }
  }
  return data as T;
}

// ─── Date helpers (he-IL, Asia/Jerusalem) ───────────────────────

export function heDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function heDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  const day = date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

/** ISO → value for <input type="datetime-local"> (local timezone). */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Extract an 11-char YouTube video id from a pasted URL, or return input as-is. */
export function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return trimmed;
}

// ─── Modal wrapper (Petra modal pattern) ────────────────────────

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal-content ${maxWidth} mx-4 p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
