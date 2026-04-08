import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { writeAuthAudit } from "@/lib/auth/audit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { db } from "@/lib/db/client";
import { userTenantMappings, users } from "@/lib/db/schema";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenant_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Payload de autenticacao invalido.",
        correlationId,
        { issues: parsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.email, parsed.data.email), eq(users.isActive, true)))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Credenciais invalidas.", correlationId),
      { status: 401 },
    );
  }

  const mappingRows = await db
    .select({
      tenantId: userTenantMappings.tenantId,
      role: userTenantMappings.role,
    })
    .from(userTenantMappings)
    .where(eq(userTenantMappings.userId, user.id))
    .limit(100);

  const mapping = parsed.data.tenant_id
    ? mappingRows.find((row) => row.tenantId === parsed.data.tenant_id)
    : mappingRows.length === 1
      ? mappingRows[0]
      : undefined;

  if (!mapping) {
    if (mappingRows.length > 1 && !parsed.data.tenant_id) {
      return NextResponse.json(
        errorResponse(
          "CONFLICT",
          "Usuario vinculado a mais de um tenant. Informe tenant_id para autenticar.",
          correlationId,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Usuario sem vinculacao de tenant.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!isValidPassword) {
    await writeAuthAudit({
      tenantId: mapping.tenantId,
      actorId: user.id,
      action: "auth.session.login.v1",
      status: "failure",
      correlationId,
      details: { reason: "invalid_credentials" },
    });

    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Credenciais invalidas.", correlationId),
      { status: 401 },
    );
  }

  const ipAddress = request.headers.get("x-forwarded-for") ?? undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const session = await createSession({
    userId: user.id,
    tenantId: mapping.tenantId,
    ipAddress,
    userAgent,
  });

  await writeAuthAudit({
    tenantId: mapping.tenantId,
    actorId: user.id,
    action: "auth.session.login.v1",
    status: "success",
    correlationId,
    ipAddress,
    details: { role: mapping.role },
  });

  const response = NextResponse.json(
    successResponse(
      {
        userId: user.id,
        email: user.email,
        tenantId: mapping.tenantId,
        role: mapping.role,
      },
      correlationId,
      mapping.tenantId,
    ),
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions(session.expiresAt),
  );

  return response;
}
