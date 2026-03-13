export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calcOrder, CalcLineInput } from "@/lib/order-calc";
import { createOrderReminder } from "@/lib/scheduled-messages";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: authResult.businessId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        lines: true,
        payments: { select: { id: true, amount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:orders:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { customerId, orderType, startAt, endAt, lines, discountType, discountValue, notes, status, appointmentData, trainingSubType, trainingPackageId, trainingBoardingStart, trainingBoardingEnd } = body;

    if (!customerId || !lines || lines.length === 0) {
      return NextResponse.json({ error: "customerId and at least one line are required" }, { status: 400 });
    }

    // Fetch business VAT settings
    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { vatEnabled: true, vatRate: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Calculate order totals server-side
    const calcInput: CalcLineInput[] = lines.map((l: { name: string; unit: string; quantity: number; unitPrice: number; taxMode?: string; metadata?: any }) => ({
      name: l.name,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxMode: (l.taxMode || "taxable") as "inherit" | "taxable" | "exempt",
    }));

    const calc = calcOrder({
      lines: calcInput,
      discountType: discountType || "none",
      discountValue: discountValue || 0,
      vatEnabled: business.vatEnabled,
      vatRate: business.vatRate,
    });

    // Order types that create a linked Appointment
    const APPT_ORDER_TYPES = ["training", "grooming", "service_dog"];
    const APPT_TYPE_LABELS: Record<string, string> = {
      training: "אילוף",
      grooming: "טיפוח",
      service_dog: "כלב שירות",
    };

    // Create order + lines + optional appointment atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          businessId: authResult.businessId,
          customerId,
          orderType: orderType || "sale",
          status: status || "draft",
          startAt: startAt ? new Date(startAt) : undefined,
          endAt: endAt ? new Date(endAt) : undefined,
          subtotal: calc.subtotal,
          discountType: discountType || "none",
          discountValue: discountValue || 0,
          discountAmount: calc.discountAmount,
          taxTotal: calc.taxTotal,
          total: calc.total,
          notes: notes || null,
        },
      });

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const cl = calc.lines[i];
        await tx.orderLine.create({
          data: {
            orderId: created.id,
            businessId: authResult.businessId,
            priceListItemId: l.priceListItemId || null,
            name: cl.name,
            unit: cl.unit,
            quantity: cl.quantity,
            unitPrice: cl.unitPrice,
            lineSubtotal: cl.lineSubtotal,
            lineTax: cl.lineTax,
            lineTotal: cl.lineTotal,
            taxMode: cl.taxMode,
            metadata: l.metadata ? JSON.stringify(l.metadata) : "{}",
          },
        });
      }

      // Create linked Appointment for service-based order types
      if (appointmentData && APPT_ORDER_TYPES.includes(orderType)) {
        const typeLabel = APPT_TYPE_LABELS[orderType] || orderType;
        const apptNotes = `[${typeLabel}] ${notes || ""}`.trim();
        const appt = await tx.appointment.create({
          data: {
            date: new Date(appointmentData.date),
            startTime: appointmentData.startTime,
            endTime: appointmentData.endTime,
            status: "scheduled",
            serviceId: appointmentData.serviceId ?? null,
            customerId,
            petId: appointmentData.petId ?? null,
            businessId: authResult.businessId,
            notes: apptNotes || null,
          },
        });
        await tx.order.update({
          where: { id: created.id },
          data: { relatedEntityType: "Appointment", relatedEntityId: appt.id },
        });
      }

      // Auto-create TrainingProgram (+ BoardingStay if boarding subtype) for training orders
      const trainingPetId = appointmentData?.petId || body.petId;
      if (orderType === "training" && trainingPetId) {
        // GROUP: add dog as participant to existing group (no TrainingProgram created)
        if (trainingSubType === "group" && body.trainingGroupId) {
          await tx.trainingGroupParticipant.upsert({
            where: {
              trainingGroupId_dogId: { trainingGroupId: body.trainingGroupId, dogId: trainingPetId },
            },
            create: {
              trainingGroupId: body.trainingGroupId,
              dogId: trainingPetId,
              customerId,
              status: "ACTIVE",
            },
            update: { status: "ACTIVE", customerId },
          });
        } else {
          // PACKAGE: always isPackage=true for package subtype; look up TrainingPackage for sessions
          let isPkg = trainingSubType === "package";
          let resolvedPackageId: string | null = trainingPackageId || null;
          let resolvedPriceListItemId: string | null = null;
          let totalSessions: number | null = null;
          let programName = lines[0]?.name || "תוכנית אילוף";

          if (isPkg && resolvedPackageId) {
            const pkg = await tx.trainingPackage.findFirst({
              where: { id: resolvedPackageId, businessId: authResult.businessId },
            });
            if (pkg) {
              totalSessions = pkg.sessions ?? null;
              programName = pkg.name;
            }
          } else if (!isPkg) {
            // Legacy: detect package via PriceListItem.sessions
            const lineItemIds = lines
              .map((l: { priceListItemId?: string | null }) => l.priceListItemId)
              .filter(Boolean) as string[];
            if (lineItemIds.length > 0) {
              const pkgItem = await tx.priceListItem.findFirst({
                where: { id: { in: lineItemIds }, businessId: authResult.businessId, sessions: { gt: 0 } },
              });
              if (pkgItem) {
                isPkg = true;
                resolvedPriceListItemId = pkgItem.id;
                totalSessions = (pkgItem as { sessions?: number | null }).sessions ?? null;
                programName = pkgItem.name;
              }
            }
          }

          if (!isPkg || (!resolvedPackageId && !resolvedPriceListItemId)) {
            const sessionLines = lines.filter((l: { unit: string }) => l.unit === "per_session");
            if (sessionLines.length > 0) {
              totalSessions = Math.round(sessionLines.reduce((sum: number, l: { quantity: number }) => sum + l.quantity, 0));
            }
          }

          // For boarding training: create a BoardingStay first, then link program to it
          let boardingStayId: string | null = null;
          if (trainingSubType === "boarding" && trainingBoardingStart) {
            const stay = await tx.boardingStay.create({
              data: {
                businessId: authResult.businessId,
                customerId,
                petId: trainingPetId,
                checkIn: new Date(trainingBoardingStart),
                checkOut: trainingBoardingEnd ? new Date(trainingBoardingEnd) : null,
                status: "reserved",
                roomId: null,
                notes: notes || null,
              },
            });
            boardingStayId = stay.id;
          }

          await tx.trainingProgram.create({
            data: {
              businessId: authResult.businessId,
              dogId: trainingPetId,
              customerId,
              name: programName,
              programType: (body.programType as string) || "BASIC_OBEDIENCE",
              trainingType: trainingSubType === "boarding" ? "BOARDING" : "HOME",
              startDate: trainingSubType === "boarding" && trainingBoardingStart
                ? new Date(trainingBoardingStart)
                : appointmentData?.date ? new Date(appointmentData.date) : new Date(),
              totalSessions,
              price: calc.total || null,
              notes: notes || null,
              isPackage: isPkg,
              orderId: created.id,
              packageId: resolvedPackageId || null,
              priceListItemId: resolvedPriceListItemId || null,
              boardingStayId: boardingStayId || null,
            },
          });
        }
      }

      return created;
    });

    // Schedule WhatsApp reminder only if explicitly requested
    if (body.sendReminder === true && startAt) {
      try {
        await createOrderReminder(order.id, customerId, new Date(startAt), authResult.businessId);
      } catch (err) {
        console.error("Failed to schedule reminder:", err);
        // Non-blocking — order was already created
      }
    }

    // Return with includes
    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        lines: true,
        payments: true,
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
