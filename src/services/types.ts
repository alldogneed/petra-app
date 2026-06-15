import type { Prisma } from "@prisma/client";

// Re-export Prisma types used across services
export type PrismaClient = Prisma.TransactionClient;

// Shared filter types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
}

// Service-layer error (not HTTP-aware)
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "VALIDATION"
      | "CONFLICT"
      | "EXTERNAL",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
