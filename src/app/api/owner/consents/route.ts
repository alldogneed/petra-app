export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export interface ConsentRow {
  userId: string;
  userName: string;
  userEmail: string;
  businessName: string | null;
  termsVersion: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  source: "consent_table" | "platform_user_field";
}

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format"); // "csv" | null
  const search = searchParams.get("search")?.toLowerCase() ?? "";
  const version = searchParams.get("version") ?? "";

  try {
  // Fetch all UserConsent records with user + business info
  const consents = await prisma.userConsent.findMany({
    orderBy: { acceptedAt: "desc" },
    select: {
      id: true,
      termsVersion: true,
      acceptedAt: true,
      ipAddress: true,
      userAgent: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          businessMemberships: {
            where: { isActive: true },
            take: 1,
            select: { business: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Also include users who have tosAcceptedAt but no UserConsent row (legacy)
  const legacyUsers = await prisma.platformUser.findMany({
    where: {
      tosAcceptedAt: { not: null },
      consents: { none: {} }, // no row in UserConsent table
    },
    select: {
      id: true,
      name: true,
      email: true,
      tosAcceptedVersion: true,
      tosAcceptedAt: true,
      businessMemberships: {
        where: { isActive: true },
        take: 1,
        select: { business: { select: { name: true } } },
      },
    },
  });

  const rows: ConsentRow[] = [
    ...consents.map((c) => ({
      userId: c.user.id,
      userName: c.user.name,
      userEmail: c.user.email,
      businessName: c.user.businessMemberships[0]?.business?.name ?? null,
      termsVersion: c.termsVersion,
      acceptedAt: c.acceptedAt.toISOString(),
      ipAddress: c.ipAddress,
      userAgent: c.userAgent,
      source: "consent_table" as const,
    })),
    ...legacyUsers.map((u) => ({
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      businessName: u.businessMemberships[0]?.business?.name ?? null,
      termsVersion: u.tosAcceptedVersion ?? "1.0",
      acceptedAt: u.tosAcceptedAt!.toISOString(),
      ipAddress: null,
      userAgent: null,
      source: "platform_user_field" as const,
    })),
  ];

  // Filter
  const filtered = rows.filter((r) => {
    if (search && !r.userName.toLowerCase().includes(search) && !r.userEmail.toLowerCase().includes(search) && !(r.businessName ?? "").toLowerCase().includes(search)) return false;
    if (version && r.termsVersion !== version) return false;
    return true;
  });

  // CSV export
  if (format === "csv") {
    const BOM = "\uFEFF";
    const header = "שם משתמש,כתובת מייל,שם עסק,גרסת תנאים,תאריך הסכמה,כתובת IP,דפדפן";
    const csvRows = filtered.map((r) => {
      const date = new Date(r.acceptedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
      const ua = (r.userAgent ?? "").slice(0, 100).replace(/,/g, ";");
      return [
        `"${r.userName}"`,
        `"${r.userEmail}"`,
        `"${r.businessName ?? ""}"`,
        r.termsVersion,
        `"${date}"`,
        r.ipAddress ?? "",
        `"${ua}"`,
      ].join(",");
    });
    const csv = BOM + [header, ...csvRows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="consents-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Collect unique versions for filter dropdown
  const versions = [...new Set(rows.map((r) => r.termsVersion))].sort();

  return NextResponse.json({ rows: filtered, total: filtered.length, totalAll: rows.length, versions });
  } catch (error) {
    console.error("GET /api/owner/consents error:", error);
    return NextResponse.json({ error: "Failed to fetch consents" }, { status: 500 });
  }
}
