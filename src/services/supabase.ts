/**
 * Database client helpers for the service layer.
 *
 * UI routes: import the singleton from @/lib/prisma (already session-scoped via requireBusinessAuth)
 * MCP routes (phase 1+): will call getPrismaClient() to get an isolated client per request
 *
 * All service functions accept `db` as their second parameter so callers control the client.
 * This enables transactions: callers pass a transaction client from prisma.$transaction().
 */

import prisma from "@/lib/prisma";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

export type DbClient = PrismaClientType;

/** Returns the singleton Prisma client (used by UI API routes). */
export function getDb(): DbClient {
  return prisma as unknown as DbClient;
}
