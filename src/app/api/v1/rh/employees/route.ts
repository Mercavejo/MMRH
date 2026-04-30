import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { EmployeeIdentityServiceError } from "@/modules/employee-identity/application/employee-identity-service-error";
import { listEmployeeIdentities } from "@/modules/employee-identity/application/list-employee-identities";
import { registerEmployeeIdentity } from "@/modules/employee-identity/application/register-employee-identity";
import {
  resolveRhEmployeeContext,
  withCorrelationHeader,
  writeEmployeeIdentityAuditSafely,
} from "./_shared";

const querySchema = z.object({
  status: z.enum(["pending_activation", "active", "blocked", "inactive"]).optional(),
});

const bodySchema = z.object({
  employee_name: z.string().min(1),
  reference_code: z.string().min(1),
  admission_date: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const context = await resolveRhEmployeeContext(request);
  if (!context.ok) {
    return context.response;
  }

  const queryParsed = querySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
  });

  if (!queryParsed.success) {
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse("VALIDATION_ERROR", "Filtros de colaboradores invalidos.", context.correlationId, {
          issues: queryParsed.error.issues,
        }),
        { status: 400 },
      ),
      context.correlationId,
    );
  }

  const data = await listEmployeeIdentities({
    tenantId: context.session.tenantId,
    filters: queryParsed.data,
  });

  return withCorrelationHeader(
    NextResponse.json(successResponse(data, context.correlationId, context.session.tenantId)),
    context.correlationId,
  );
}

export async function POST(request: NextRequest) {
  const context = await resolveRhEmployeeContext(request);
  if (!context.ok) {
    return context.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse("VALIDATION_ERROR", "Payload de colaborador invalido.", context.correlationId, {
          issues: parsed.error.issues,
        }),
        { status: 400 },
      ),
      context.correlationId,
    );
  }

  try {
    const created = await registerEmployeeIdentity({
      tenantId: context.session.tenantId,
      actorId: context.session.userId,
      employeeName: parsed.data.employee_name,
      referenceCode: parsed.data.reference_code,
      admissionDate: parsed.data.admission_date,
      notes: parsed.data.notes,
    });

    await writeEmployeeIdentityAuditSafely({
      tenantId: context.session.tenantId,
      actorId: context.session.userId,
      correlationId: context.correlationId,
      action: "rh.employee_identity.created.v1",
      resourceId: created.employee_id,
      status: "success",
      details: {
        reference_code: created.reference_code,
        status: created.status,
      },
    });

    return withCorrelationHeader(
      NextResponse.json(
        successResponse(created, context.correlationId, context.session.tenantId),
        { status: 201 },
      ),
      context.correlationId,
    );
  } catch (error) {
    if (error instanceof EmployeeIdentityServiceError) {
      await writeEmployeeIdentityAuditSafely({
        tenantId: context.session.tenantId,
        actorId: context.session.userId,
        correlationId: context.correlationId,
        action: "rh.employee_identity.create.rejected.v1",
        resourceId: parsed.data.reference_code,
        status: "failure",
        details: error.details,
      });

      return withCorrelationHeader(
        NextResponse.json(
          errorResponse(error.code, error.message, context.correlationId, error.details),
          { status: error.statusCode },
        ),
        context.correlationId,
      );
    }

    return withCorrelationHeader(
      NextResponse.json(
        errorResponse(
          "INTERNAL_SERVER_ERROR",
          "Falha ao cadastrar colaborador funcional.",
          context.correlationId,
        ),
        { status: 500 },
      ),
      context.correlationId,
    );
  }
}
