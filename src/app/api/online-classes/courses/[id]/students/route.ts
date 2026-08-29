export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { enrollStudentsInCourse } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../../../_lib";

/**
 * Manually enroll students into a course by email.
 * Body: { students: [{ email, name?, phone? }], validUntil?, paymentNote?, notify? }
 * Also accepts { emails: "a@b.com, c@d.com" } / string[] as a shorthand.
 */
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

    // Normalize the three accepted shapes into one list.
    let students: Array<{ email: string; name?: string | null; phone?: string | null }> = [];

    if (Array.isArray(body.students)) {
      students = (body.students as unknown[]).flatMap((s) => {
        if (typeof s === "string") return [{ email: s }];
        if (s && typeof s === "object") {
          const o = s as Record<string, unknown>;
          if (typeof o.email !== "string") return [];
          return [
            {
              email: o.email,
              name: typeof o.name === "string" ? o.name : null,
              phone: typeof o.phone === "string" ? o.phone : null,
            },
          ];
        }
        return [];
      });
    } else if (typeof body.emails === "string") {
      students = body.emails
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ email }));
    } else if (Array.isArray(body.emails)) {
      students = (body.emails as unknown[])
        .filter((e): e is string => typeof e === "string")
        .map((email) => ({ email: email.trim() }))
        .filter((s) => s.email);
    }

    if (students.length === 0) return badRequest("לא נשלחו כתובות אימייל");
    if (students.length > 200) return badRequest("ניתן להוסיף עד 200 תלמידים בבת אחת");

    let validUntil: Date | null | undefined;
    if (body.validUntil !== undefined) {
      if (body.validUntil === null || body.validUntil === "") {
        validUntil = null;
      } else if (typeof body.validUntil === "string") {
        const d = new Date(body.validUntil);
        if (isNaN(d.getTime())) return badRequest("תאריך תוקף לא תקין");
        validUntil = d;
      } else {
        return badRequest("תאריך תוקף לא תקין");
      }
    }

    const paymentNote =
      typeof body.paymentNote === "string" ? body.paymentNote.trim().slice(0, 500) : undefined;

    const result = await enrollStudentsInCourse(auth.businessId, params.id, students, {
      ...(validUntil !== undefined ? { validUntil } : {}),
      ...(paymentNote !== undefined ? { paymentNote } : {}),
      notify: body.notify !== false,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/courses/[id]/students", error)
    );
  }
}
