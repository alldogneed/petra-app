import { NextResponse } from "next/server";
import type { ServiceError } from "@/services/types";

const STATUS: Record<ServiceError["code"], number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 403,
  VALIDATION: 400,
  CONFLICT: 409,
  EXTERNAL: 502,
};

/** ServiceError → JSON response with its (Hebrew) message. */
export function serviceErrorResponse(e: ServiceError) {
  return NextResponse.json({ error: e.message }, { status: STATUS[e.code] ?? 400 });
}
