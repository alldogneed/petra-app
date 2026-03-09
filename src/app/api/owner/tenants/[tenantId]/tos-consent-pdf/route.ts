export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";

interface ConsentRecord {
  termsVersion: string;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

interface MemberWithConsents {
  user: {
    name: string;
    email: string;
    tosAcceptedVersion: string | null;
    tosAcceptedAt: Date | null;
    consents: ConsentRecord[];
  };
}

function buildConsentHtml(
  businessName: string,
  members: MemberWithConsents[],
  generatedAt: Date
): string {
  const formattedDate = generatedAt.toLocaleString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });

  // Collect all consent rows
  const rows: { name: string; email: string; version: string; acceptedAt: Date; ip: string; ua: string }[] = [];

  for (const member of members) {
    const { name, email, consents, tosAcceptedVersion, tosAcceptedAt } = member.user;

    if (consents.length > 0) {
      for (const consent of consents) {
        rows.push({
          name,
          email,
          version: consent.termsVersion,
          acceptedAt: new Date(consent.acceptedAt),
          ip: consent.ipAddress ?? "—",
          ua: consent.userAgent ? consent.userAgent.slice(0, 80) : "—",
        });
      }
    } else if (tosAcceptedAt) {
      // Fallback: use tosAcceptedAt/tosAcceptedVersion fields on PlatformUser
      rows.push({
        name,
        email,
        version: tosAcceptedVersion ?? "1.0",
        acceptedAt: new Date(tosAcceptedAt),
        ip: "—",
        ua: "—",
      });
    }
  }

  const tableRows =
    rows.length === 0
      ? `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:24px; font-size:14px;">לא נמצאה קבלת תנאי שימוש עבור עסק זה</td></tr>`
      : rows
          .map(
            (r) => `
        <tr>
          <td>${escHtml(r.name)}</td>
          <td dir="ltr">${escHtml(r.email)}</td>
          <td style="text-align:center">${escHtml(r.version)}</td>
          <td>${new Date(r.acceptedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</td>
          <td dir="ltr">${escHtml(r.ip)}</td>
          <td dir="ltr" style="font-size:11px; word-break:break-all">${escHtml(r.ua)}</td>
        </tr>`
          )
          .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>אישור תנאי שימוש — ${escHtml(businessName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      direction: rtl;
      color: #1e293b;
      padding: 32px;
      font-size: 13px;
      line-height: 1.5;
    }
    h1 { font-size: 24px; font-weight: 700; color: #f97316; }
    h2 { font-size: 18px; font-weight: 600; color: #1e293b; margin-top: 6px; }
    .header {
      text-align: center;
      margin-bottom: 28px;
      border-bottom: 2px solid #f97316;
      padding-bottom: 16px;
    }
    .header p { color: #64748b; margin-top: 6px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; font-size: 12px; color: #475569; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer {
      margin-top: 32px;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
    }
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 24px;
      padding: 10px 20px;
      background: #f97316;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .print-btn:hover { background: #ea580c; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 16px; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
  <script>window.onload = function() { window.print(); };</script>
</head>
<body>
  <div class="header">
    <h1>Petra</h1>
    <h2>אישור קבלת תנאי שימוש</h2>
    <p>עסק: <strong>${escHtml(businessName)}</strong></p>
    <p>הופק בתאריך: ${formattedDate}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>שם משתמש</th>
        <th>כתובת מייל</th>
        <th>גרסת תנאים</th>
        <th>תאריך ושעת הסכמה</th>
        <th>כתובת IP</th>
        <th>דפדפן</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    מסמך זה הופק אוטומטית ממערכת Petra ומהווה ראיה לקבלת תנאי השימוש.
    כתובת ה-IP, סוכן הדפדפן ותאריך ההסכמה נרשמו בזמן אמת בעת הרשמת המשתמש.
  </div>

  <div class="no-print" style="margin-top:24px">
    <button class="print-btn" onclick="window.print()">
      🖨 הדפס / שמור כ-PDF
    </button>
  </div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const business = await prisma.business.findUnique({
    where: { id: params.tenantId },
    select: { name: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await prisma.businessUser.findMany({
    where: { businessId: params.tenantId },
    select: {
      user: {
        select: {
          name: true,
          email: true,
          tosAcceptedVersion: true,
          tosAcceptedAt: true,
          consents: {
            orderBy: { acceptedAt: "desc" },
            select: {
              termsVersion: true,
              acceptedAt: true,
              ipAddress: true,
              userAgent: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const html = buildConsentHtml(business.name, members, new Date());
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
