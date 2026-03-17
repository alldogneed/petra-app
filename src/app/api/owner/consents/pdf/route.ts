export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PDFDocument, PageSizes, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

// ── Hebrew visual-order helper ────────────────────────────────────────────────
// pdf-lib renders glyphs LTR. Reversing a Hebrew string produces correct
// visual RTL output when drawn left-to-right with a Unicode font.
function vrtl(s: string): string {
  return s.split("").reverse().join("");
}

function hasHebrew(s: string): boolean {
  return /[\u0590-\u05FF]/.test(s);
}

function formatDateHe(d: Date): string {
  return d.toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function truncateUA(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

const TOS_SECTIONS = [
  "1. מבוא", "2. הגדרות", "3. רישום ושימוש",
  "4. מדיניות שימוש מקובל (Acceptable Use)", "5. רישוי וקניין רוחני",
  "6. תשלומים ומנויים", "7. שמירת מידע והעברת נתונים",
  "8. פרטיות ואבטחת מידע", "9. אחריות ומגבלות", "10. שיפוי",
  "11. סיום שירות", "12. שינויים בתנאים", "13. סמכות שיפוט", "14. כוח עליון",
];

// ── PDF builder ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {

  const user = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      tosAcceptedAt: true,
      tosAcceptedVersion: true,
      businessMemberships: {
        where: { isActive: true },
        take: 1,
        select: { business: { select: { name: true } } },
      },
      consents: {
        orderBy: { acceptedAt: "desc" },
        take: 1,
        select: { termsVersion: true, acceptedAt: true, ipAddress: true, userAgent: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const consent = user.consents[0] ?? (user.tosAcceptedAt
    ? { termsVersion: user.tosAcceptedVersion ?? "1.0", acceptedAt: user.tosAcceptedAt, ipAddress: null, userAgent: null }
    : null);

  if (!consent) return NextResponse.json({ error: "No consent record found" }, { status: 404 });

  const businessName = user.businessMemberships[0]?.business?.name ?? null;

  // ── Build PDF ─────────────────────────────────────────────────────────────

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize(); // 595.28 × 841.89

  const heeboBytes = fs.readFileSync(path.join(process.cwd(), "public/fonts/Heebo-Regular.ttf"));
  const heebo = await pdfDoc.embedFont(heeboBytes);

  const iconBytes = fs.readFileSync(path.join(process.cwd(), "public/icon.png"));
  const icon = await pdfDoc.embedPng(iconBytes);

  const M = 55; // margin
  const contentW = width - M * 2;
  const rightEdge = width - M;

  const cDark   = rgb(0.07, 0.07, 0.14);
  const cAccent = rgb(0.02, 0.71, 0.84);
  const cGray   = rgb(0.45, 0.51, 0.58);
  const cLine   = rgb(0.87, 0.90, 0.93);
  const cWhite  = rgb(1, 1, 1);

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.98, 0.99) });

  // Top accent bar
  page.drawRectangle({ x: 0, y: height - 7, width, height: 7, color: cAccent });

  // Icon
  const iconSize = 44;
  page.drawImage(icon, { x: (width - iconSize) / 2, y: height - 78, width: iconSize, height: iconSize });

  // Title
  const titleRaw = "אישור קבלת תנאי שימוש";
  const titleStr = vrtl(titleRaw);
  const titleSize = 20;
  const titleW = heebo.widthOfTextAtSize(titleStr, titleSize);
  page.drawText(titleStr, { x: (width - titleW) / 2, y: height - 103, size: titleSize, font: heebo, color: cDark });

  // Subtitle
  const sub = "Petra Platform — Terms of Service Certificate";
  const subSize = 9;
  const subW = heebo.widthOfTextAtSize(sub, subSize);
  page.drawText(sub, { x: (width - subW) / 2, y: height - 120, size: subSize, font: heebo, color: cGray });

  // Divider below header
  page.drawLine({ start: { x: M, y: height - 136 }, end: { x: rightEdge, y: height - 136 }, thickness: 0.8, color: cLine });

  // ── White card ───────────────────────────────────────────────────────────
  const cardTop = height - 148;
  const rowH = 38;
  const numRows = 7;
  const cardH = numRows * rowH + 28;
  page.drawRectangle({
    x: M, y: cardTop - cardH,
    width: contentW, height: cardH,
    color: cWhite,
    borderColor: cLine,
    borderWidth: 1,
    borderOpacity: 1,
  });

  // Helper: draw a right-aligned value (Hebrew reversed or LTR as-is)
  function drawValue(text: string, y: number) {
    const str = hasHebrew(text) ? vrtl(text) : text;
    const w = heebo.widthOfTextAtSize(str, 11);
    page.drawText(str, { x: rightEdge - M + M - 20 - w, y, size: 11, font: heebo, color: cDark });
  }

  const fields: { label: string; value: string }[] = [
    { label: "User Name",     value: user.name },
    { label: "Email Address", value: user.email },
    { label: "Business",      value: businessName ?? "—" },
    { label: "Terms Version", value: `v${consent.termsVersion}` },
    { label: "Accepted At",   value: formatDateHe(consent.acceptedAt) },
    { label: "IP Address",    value: consent.ipAddress ?? "—" },
    { label: "Browser",       value: truncateUA(consent.userAgent) },
  ];

  const firstRowY = cardTop - 20;
  const innerLeft = M + 20;
  const innerRight = rightEdge - 20;

  fields.forEach((f, i) => {
    const baseY = firstRowY - i * rowH;

    // Label (small gray, English)
    page.drawText(f.label, { x: innerLeft, y: baseY, size: 8, font: heebo, color: cGray });

    // Value (right-aligned, Hebrew reversed if needed)
    const str = hasHebrew(f.value) ? vrtl(f.value) : f.value;
    const valW = heebo.widthOfTextAtSize(str, 11);
    page.drawText(str, { x: innerRight - valW, y: baseY - 13, size: 11, font: heebo, color: cDark });

    // Separator
    if (i < fields.length - 1) {
      page.drawLine({
        start: { x: innerLeft, y: baseY - rowH + 8 },
        end:   { x: innerRight, y: baseY - rowH + 8 },
        thickness: 0.5,
        color: rgb(0.93, 0.95, 0.97),
      });
    }
  });

  // ── Legal notice ──────────────────────────────────────────────────────────
  const legalY = cardTop - cardH - 24;
  const legalRaw = "מסמך זה מהווה אישור חוקי לכך שהמשתמש קרא, הבין וקיבל את תנאי השימוש ומדיניות הפרטיות של Petra.";
  const legalStr = vrtl(legalRaw);
  const legalW = heebo.widthOfTextAtSize(legalStr, 8);
  page.drawText(legalStr, { x: (width - legalW) / 2, y: legalY, size: 8, font: heebo, color: cGray });

  // ── ToS section ──────────────────────────────────────────────────────────
  const tosHeaderY = legalY - 26;

  // Section box
  const tosSectionH = 14 + TOS_SECTIONS.length * 14 + 28;
  page.drawRectangle({
    x: M, y: tosHeaderY - tosSectionH,
    width: contentW, height: tosSectionH,
    color: cWhite, borderColor: cLine, borderWidth: 1, borderOpacity: 1,
  });

  // Section header label (LTR English)
  page.drawText("Agreement Scope — what the user accepted:", {
    x: innerLeft, y: tosHeaderY - 10, size: 8, font: heebo, color: cGray,
  });

  // ToS URL (right-aligned, LTR)
  const tosUrl = "petra-app.com/terms";
  const tosUrlW = heebo.widthOfTextAtSize(tosUrl, 8);
  page.drawText(tosUrl, { x: innerRight - tosUrlW, y: tosHeaderY - 10, size: 8, font: heebo, color: cAccent });

  // Section divider
  page.drawLine({
    start: { x: innerLeft, y: tosHeaderY - 18 },
    end:   { x: innerRight, y: tosHeaderY - 18 },
    thickness: 0.5, color: cLine,
  });

  // Section titles (2 per row to save space, Hebrew reversed)
  const colW = contentW / 2 - 20;
  TOS_SECTIONS.forEach((sec, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? innerRight - colW : innerLeft;
    const y = tosHeaderY - 30 - row * 14;
    const str = vrtl(sec);
    const sw = heebo.widthOfTextAtSize(str, 8);
    // right-align within its column
    page.drawText(str, { x: x - (col === 0 ? 0 : sw - colW), y, size: 8, font: heebo, color: cDark });
  });

  // Bottom accent bar
  page.drawRectangle({ x: 0, y: 0, width, height: 7, color: cAccent });

  // Footer
  const footerText = `Generated: ${new Date().toISOString().slice(0, 10)} | petra-app.com`;
  const footerW = heebo.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, { x: (width - footerW) / 2, y: 14, size: 8, font: heebo, color: cGray });

  const pdfBytes = await pdfDoc.save();
  const safeName = user.email.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `consent_${safeName}_${dateStr}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    console.error("[consent-pdf] Error generating PDF:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
