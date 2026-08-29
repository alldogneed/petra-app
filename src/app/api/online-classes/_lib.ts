// Shared helpers for the online-classes ADMIN API tree.
// Every route in src/app/api/online-classes/** must go through requireOnlineClassesAuth
// (session auth + tier gate) and map ServiceError via serviceErrorToResponse.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { ServiceError } from "@/services/types";

export type OnlineClassesAuth = { businessId: string };

/**
 * Auth + tier gate for all online-classes admin routes.
 * businessId is derived from the session ONLY — never from body/params (IDOR guard).
 * Tier: feature key "online_classes" with per-tenant overrides.
 */
export async function requireOnlineClassesAuth(
  request: NextRequest
): Promise<OnlineClassesAuth | NextResponse> {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { tier: true, featureOverrides: true },
  });
  const overrides =
    (biz?.featureOverrides as Record<string, boolean> | null) ?? null;
  if (!hasFeatureWithOverrides(biz?.tier, "online_classes", overrides)) {
    return NextResponse.json(
      { error: "הפיצ'ר זמין במסלול Pro" },
      { status: 403 }
    );
  }

  return { businessId };
}

export function isRouteGuardError(
  result: OnlineClassesAuth | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

/** Maps a ServiceError to an HTTP response. Returns null for non-ServiceError errors. */
export function serviceErrorToResponse(e: unknown): NextResponse | null {
  if (!(e instanceof ServiceError)) return null;
  switch (e.code) {
    case "NOT_FOUND":
      return NextResponse.json(
        { error: e.message || "לא נמצא" },
        { status: 404 }
      );
    case "VALIDATION":
      return NextResponse.json(
        { error: e.message || "נתונים לא תקינים" },
        { status: 400 }
      );
    case "CONFLICT":
      return NextResponse.json(
        { error: e.message || "התנגשות נתונים" },
        { status: 409 }
      );
    case "UNAUTHORIZED":
      return NextResponse.json(
        { error: e.message || "אין הרשאה" },
        { status: 403 }
      );
    default:
      return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(logPrefix: string, error: unknown): NextResponse {
  console.error(`${logPrefix} error:`, error);
  return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
}

/**
 * Optional string field reader for request bodies.
 * undefined → field absent (skip); null / non-string → null (clear);
 * string → trimmed (empty string allowed, meaning clear).
 */
export function optStr(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value.trim();
  return null;
}

/** Parses an ISO date string (or Date). Returns null when missing/invalid. */
export function parseDateField(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = new Date(value as string | Date);
  return isNaN(d.getTime()) ? null : d;
}

/** Parses a positive integer (number or numeric string). Returns null when invalid. */
export function parsePositiveInt(value: unknown, max = 100000): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseInt(value, 10)
        : NaN;
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}
