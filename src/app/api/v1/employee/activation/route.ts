import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { writeAuthAudit } from "@/lib/auth/audit";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";
import {
  activateEmployeeAccess,
  EmployeeActivationError,
} from "@/modules/employee-identity/application/activate-employee-access";
import { admissionDateInputPattern } from "@/modules/employee-identity/domain/employee-identity";
import { isValidCpfFormat, normalizeCpf } from "@/lib/validation/cpf";

const activationSchema = z.object({
  tenant_id: z.string().uuid(),
  reference_code: z.string().trim().min(1),
  admission_date: z.string().regex(admissionDateInputPattern),
  cpf: z.string().trim().refine(isValidCpfFormat, {
    message: "CPF invalido. Informe 11 digitos com ou sem pontuacao.",
  }),
  cpf_confirmation: z.string().trim().min(1),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  password: z.string().min(8),
}).superRefine((value, context) => {
  if (normalizeCpf(value.cpf) !== normalizeCpf(value.cpf_confirmation)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cpf_confirmation"],
      message: "A confirmacao do CPF deve ser identica ao CPF informado.",
    });
  }
});

function jsonWithCorrelationHeader(body: unknown, status: number, correlationId: string) {
  const response = NextResponse.json(body, { status });
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  try {
    const body = await request.json().catch(() => null);
    const parsed = activationSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithCorrelationHeader(
        errorResponse(
          "VALIDATION_ERROR",
          "Dados de primeiro acesso invalidos.",
          correlationId,
          { issues: parsed.error.issues },
        ),
        400,
        correlationId,
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const activated = await activateEmployeeAccess({
      tenantId: parsed.data.tenant_id,
      referenceCode: parsed.data.reference_code,
      admissionDate: parsed.data.admission_date,
      cpf: parsed.data.cpf,
      email: parsed.data.email,
      password: parsed.data.password,
      correlationId,
      ipAddress,
      userAgent,
    });

    try {
      await writeAuthAudit({
        tenantId: activated.tenant_id,
        actorId: activated.user_id,
        action: "auth.session.login.v1",
        status: "success",
        correlationId,
        ipAddress,
        details: {
          role: activated.role,
          activation_flow: true,
        },
      });
    } catch (error) {
      console.error("employee activation auth audit failed", error);
    }

    const response = NextResponse.json(
      successResponse(
        {
          user_id: activated.user_id,
          tenant_id: activated.tenant_id,
          employee_identity_id: activated.employee_identity_id,
          employee_name: activated.employee_name,
          email: activated.email,
          role: activated.role,
        },
        correlationId,
        activated.tenant_id,
      ),
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      activated.session.token,
      getSessionCookieOptions(activated.session.expiresAt),
    );
    response.headers.set(CORRELATION_ID_HEADER, correlationId);

    return response;
  } catch (error) {
    if (error instanceof EmployeeActivationError) {
      const status =
        error.code === "INVALID_ACTIVATION_CREDENTIALS"
          ? 403
          : error.code === "ACTIVATION_UNAVAILABLE"
            ? 409
            : error.code === "CPF_ALREADY_IN_USE"
              ? 409
            : error.code === "EMAIL_ALREADY_IN_USE"
              ? 409
              : 500;

      return jsonWithCorrelationHeader(
        errorResponse(error.code, error.message, correlationId, error.details),
        status,
        correlationId,
      );
    }

    return jsonWithCorrelationHeader(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        "Falha ao concluir seu primeiro acesso.",
        correlationId,
      ),
      500,
      correlationId,
    );
  }
}
