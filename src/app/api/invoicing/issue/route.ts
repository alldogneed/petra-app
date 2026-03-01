export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { InvoicingService } from "@/lib/invoicing/invoicing-service";
import type { DocumentType } from "@/lib/invoicing/types";
import { maskSensitive, logInvoicing } from "@/lib/invoicing/logger";

// POST /api/invoicing/issue — issue a document
// Supports two flows:
// 1. Issue from draft: { invoiceId } — loads draft, sends to provider, updates record
// 2. Direct issue from payment: { paymentId, docType? } — original flow
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { invoiceId, paymentId, docType } = body;

    // Flow 1: Issue from draft invoice
    if (invoiceId) {
      const draft = await prisma.invoiceDocument.findFirst({
        where: { id: invoiceId, businessId: authResult.businessId },
      });

      if (!draft) {
        return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
      }

      if (draft.status !== "draft" && draft.status !== "failed") {
        return NextResponse.json(
          { error: "ניתן להנפיק טיוטות או מסמכים שנכשלו בלבד" },
          { status: 400 }
        );
      }

      // Mark as pending
      await prisma.invoiceDocument.update({
        where: { id: invoiceId },
        data: { status: "pending" },
      });

      try {
        // If linked to a payment, use the existing service flow
        if (draft.paymentId) {
          const result = await InvoicingService.issue(
            authResult.businessId,
            draft.paymentId,
            { docType: draft.docType as DocumentType }
          );

          // Update the draft with provider response
          await prisma.invoiceDocument.update({
            where: { id: invoiceId },
            data: {
              status: "issued",
              providerDocId: result.providerDocId,
              documentNumber: result.documentNumber,
              documentUrl: result.documentUrl,
              providerRawJson: JSON.stringify(maskSensitive(result)),
              failureReason: null,
            },
          });

          return NextResponse.json(result);
        }

        // Standalone draft (no payment) - issue directly via provider
        const result = await InvoicingService.issueDraft(authResult.businessId, invoiceId);

        return NextResponse.json(result);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "שגיאה בהנפקה";
        logInvoicing("error", "Issue from draft failed", { invoiceId, error: errorMsg });

        await prisma.invoiceDocument.update({
          where: { id: invoiceId },
          data: { status: "failed", failureReason: errorMsg },
        });

        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }
    }

    // Flow 2: Direct issue from payment (original flow)
    if (!paymentId) {
      return NextResponse.json({ error: "חסר paymentId או invoiceId" }, { status: 400 });
    }

    const result = await InvoicingService.issue(
      authResult.businessId,
      paymentId,
      docType ? { docType: docType as DocumentType } : undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Issue document error:", error);
    const message = error instanceof Error ? error.message : "שגיאה בהפקת מסמך";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
