import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { writeAuthAudit } from "@/lib/auth/audit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { rotateSession } from "@/lib/auth/session";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      { status: 401 },
    );
  }

  const ipAddress = request.headers.get("x-forwarded-for") ?? undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const rotated = await rotateSession({ token, ipAddress, userAgent });

  if (!rotated) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      { status: 401 },
    );
  }

  await writeAuthAudit({
    tenantId: rotated.session.tenantId,
    actorId: rotated.session.userId,
    action: "auth.session.refresh.v1",
    status: "success",
    correlationId,
    ipAddress,
  });

  const response = NextResponse.json(
    successResponse(
      {
        refreshed: true,
        userId: rotated.session.userId,
        tenantId: rotated.session.tenantId,
      },
      correlationId,
      rotated.session.tenantId,
    ),
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    rotated.token,
    getSessionCookieOptions(rotated.expiresAt),
  );

  return response;
}
