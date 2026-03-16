export const dynamic = "force-dynamic";
/**
 * GET  /api/service-recipient-stages — list stages (auto-seed if empty)
 * POST /api/service-recipient-stages — create custom stage
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const DEFAULT_STAGES = [
  { key: "LEAD",              name: "ליד",                  color: "bg-slate-100 text-slate-600",     sortOrder: 0, isBuiltIn: true },
  { key: "INTAKE",            name: "קבלה",                 color: "bg-purple-100 text-purple-700",   sortOrder: 1, isBuiltIn: true },
  { key: "WAITLIST",          name: "המתנה",                color: "bg-amber-100 text-amber-700",     sortOrder: 2, isBuiltIn: true },
  { key: "MATCHED",           name: "שובץ",                 color: "bg-blue-100 text-blue-700",       sortOrder: 3, isBuiltIn: true },
  { key: "ADVANCED_TRAINING", name: "אימון מתקדם",          color: "bg-indigo-100 text-indigo-700",   sortOrder: 4, isBuiltIn: true },
  { key: "ACTIVE",            name: "נמסר כלב",             color: "bg-emerald-100 text-emerald-700", sortOrder: 5, isBuiltIn: true },
  { key: "REJECTED",          name: "נדחה",                 color: "bg-red-100 text-red-600",         sortOrder: 6, isBuiltIn: true },
];

async function ensureStages(businessId: string) {
  // Upsert built-in stages so existing businesses always get the updated names/order
  for (const s of DEFAULT_STAGES) {
    await prisma.serviceRecipientStage.upsert({
      where: { businessId_key: { businessId, key: s.key } },
      update: { name: s.name, color: s.color, sortOrder: s.sortOrder },
      create: { ...s, businessId },
    });
  }
  // Remove old built-in keys that no longer exist in DEFAULT_STAGES
  const validKeys = DEFAULT_STAGES.map((s) => s.key);
  await prisma.serviceRecipientStage.deleteMany({
    where: { businessId, isBuiltIn: true, key: { notIn: validKeys } },
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    await ensureStages(auth.businessId);

    const stages = await prisma.serviceRecipientStage.findMany({
      where: { businessId: auth.businessId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(stages);
  } catch (e) {
    console.error("GET stages error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const body = await request.json();
    const { name, color } = body;
    if (!name?.trim()) return NextResponse.json({ error: "שם שלב חסר" }, { status: 400 });

    // Generate unique key for custom stage
    const key = "CUSTOM_" + Date.now().toString(36).toUpperCase();

    // sortOrder = max existing + 1
    const maxOrder = await prisma.serviceRecipientStage.aggregate({
      where: { businessId: auth.businessId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

    const stage = await prisma.serviceRecipientStage.create({
      data: {
        businessId: auth.businessId,
        key,
        name: name.trim(),
        color: color || "bg-slate-100 text-slate-600",
        sortOrder,
        isBuiltIn: false,
      },
    });

    return NextResponse.json(stage, { status: 201 });
  } catch (e) {
    console.error("POST stages error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
