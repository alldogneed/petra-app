import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Always cache on globalThis — in production this reuses the client
// across requests within the same warm serverless function instance,
// avoiding the cost of creating a new connection pool every request.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;

export default prisma;
