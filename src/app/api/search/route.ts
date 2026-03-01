export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }
    if (q.length > 100) {
      return NextResponse.json(
        { error: "Search query too long" },
        { status: 400 }
      );
    }

    const [customers, pets, appointments, boarding] = await Promise.all([
      prisma.customer.findMany({
        where: {
          businessId: authResult.businessId,
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { name: "asc" },
      }),

      prisma.pet.findMany({
        where: {
          customer: { businessId: authResult.businessId },
          OR: [
            { name: { contains: q } },
            { breed: { contains: q } },
          ],
        },
        include: {
          customer: {
            select: { id: true, name: true },
          },
        },
        take: 5,
        orderBy: { name: "asc" },
      }),

      prisma.appointment.findMany({
        where: {
          businessId: authResult.businessId,
          OR: [
            { notes: { contains: q } },
            { customer: { name: { contains: q } } },
            { service: { name: { contains: q } } },
          ],
        },
        include: {
          customer: {
            select: { name: true },
          },
          service: {
            select: { name: true },
          },
        },
        take: 5,
        orderBy: { date: "desc" },
      }),

      prisma.boardingStay.findMany({
        where: {
          businessId: authResult.businessId,
          OR: [
            { notes: { contains: q } },
            { pet: { name: { contains: q } } },
            { customer: { name: { contains: q } } },
          ],
        },
        include: {
          pet: {
            select: { name: true },
          },
          customer: {
            select: { name: true },
          },
          room: {
            select: { name: true },
          },
        },
        take: 5,
        orderBy: { checkIn: "desc" },
      }),
    ]);

    return NextResponse.json({
      customers,
      pets,
      appointments,
      boarding,
    });
  } catch (error) {
    console.error("Failed to search:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
