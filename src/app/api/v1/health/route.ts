import { NextRequest, NextResponse } from "next/server";
import { successResponse } from "@/lib/api/response";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  return NextResponse.json(
    successResponse(
      {
        service: "sistema-adalto",
        status: "ok",
      },
      correlationId,
    ),
  );
}
