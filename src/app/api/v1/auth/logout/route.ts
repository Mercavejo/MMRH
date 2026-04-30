import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { writeAuthAudit } from "@/lib/auth/audit";
import { invalidateSession, validateSession } from "@/lib/auth/session";
import { successResponse } from "@/lib/api/response";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const session = await validateSession(token);
    if (session) {
      await writeAuthAudit({
        tenantId: session.tenantId,
        actorId: session.userId,
        action: "auth.session.logout.v1",
        status: "success",
        correlationId,
      });
    }

    await invalidateSession(token);
  }

  const response = NextResponse.json(
    successResponse({ loggedOut: true }, correlationId),
  );

  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
