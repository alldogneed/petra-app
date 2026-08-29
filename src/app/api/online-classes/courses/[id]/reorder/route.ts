export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { reorderModules, reorderLessons } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../../../_lib";

const MAX_IDS = 500;

function parseIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IDS) {
    return null;
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return null;
    ids.push(item.trim());
  }
  if (new Set(ids).size !== ids.length) return null; // duplicates
  return ids;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest("גוף בקשה לא תקין");
    }

    // Variant A: reorder modules within the course
    if (body.moduleIds !== undefined) {
      const moduleIds = parseIdList(body.moduleIds);
      if (!moduleIds) return badRequest("רשימת פרקים לא תקינה");
      await reorderModules(auth.businessId, params.id, moduleIds);
      return NextResponse.json({ ok: true });
    }

    // Variant B: reorder lessons within a module
    if (body.moduleId !== undefined || body.lessonIds !== undefined) {
      const moduleId =
        typeof body.moduleId === "string" ? body.moduleId.trim() : "";
      if (!moduleId) return badRequest("נדרש מזהה פרק");
      const lessonIds = parseIdList(body.lessonIds);
      if (!lessonIds) return badRequest("רשימת שיעורים לא תקינה");
      await reorderLessons(auth.businessId, moduleId, lessonIds);
      return NextResponse.json({ ok: true });
    }

    return badRequest("נדרשת רשימת פרקים או רשימת שיעורים לסידור מחדש");
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/courses/[id]/reorder", error)
    );
  }
}
