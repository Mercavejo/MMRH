import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { EmployeeIdentityServiceError } from "@/modules/employee-identity/application/employee-identity-service-error";
import { deleteEmployeeIdentity } from "@/modules/employee-identity/application/delete-employee-identity";
import { updateEmployeeIdentity } from "@/modules/employee-identity/application/update-employee-identity";
import {
  resolveRhEmployeeContext,
  withCorrelationHeader,
  writeEmployeeIdentityAuditSafely,
} from "../_shared";

const bodySchema = z.object({
  employee_name: z.string().min(1),
  reference_code: z.string().min(1),
  admission_date: z.string().min(1),
  status: z.enum(["pending_activation", "active", "blocked", "inactive"]).optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const context = await resolveRhEmployeeContext(request);
  if (!context.ok) {
    return context.response;
  }

  const { employeeId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse("VALIDATION_ERROR", "Payload de atualizacao invalido.", context.correlationId, {
          issues: parsed.error.issues,
        }),
        { status: 400 },
      ),
      context.correlationId,
    );
  }

  try {
    const updated = await updateEmployeeIdentity({
      employeeId,
      tenantId: context.session.tenantId,
      actorId: context.session.userId,
      employeeName: parsed.data.employee_name,
      referenceCode: parsed.data.reference_code,
      admissionDate: parsed.data.admission_date,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });

    await writeEmployeeIdentityAuditSafely({
      tenantId: context.session.tenantId,
      actorId: context.session.userId,
      correlationId: context.correlationId,
      action: "rh.employee_identity.updated.v1",
      resourceId: updated.employee_id,
      status: "success",
      details: {
        reference_code: updated.reference_code,
        status: updated.status,
      },
    });

    return withCorrelationHeader(
      NextResponse.json(successResponse(updated, context.correlationId, context.session.tenantId)),
      context.correlationId,
    );
  } catch (error) {
    if (error instanceof EmployeeIdentityServiceError) {
      await writeEmployeeIdentityAuditSafely({
        tenantId: context.session.tenantId,
        actorId: context.session.userId,
        correlationId: context.correlationId,
        action: "rh.employee_identity.update.rejected.v1",
        resourceId: employeeId,
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
          "Falha ao atualizar colaborador funcional.",
          context.correlationId,
        ),
        { status: 500 },
      ),
      context.correlationId,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const context = await resolveRhEmployeeContext(request);
  if (!context.ok) {
    return context.response;
  }

  const { employeeId } = await params;

  try {
    const result = await deleteEmployeeIdentity({
      employeeId,
      tenantId: context.session.tenantId,
      actorId: context.session.userId,
    });

    await writeEmployeeIdentityAuditSafely({
      tenantId: context.session.tenantId,
      actorId: context.session.userId,
      correlationId: context.correlationId,
      action: "rh.employee_identity.deleted.v1",
      resourceId: employeeId,
      status: "success",
      details: {},
    });

    return withCorrelationHeader(
      NextResponse.json(successResponse(result, context.correlationId, context.session.tenantId)),
      context.correlationId,
    );
  } catch (error) {
    if (error instanceof EmployeeIdentityServiceError) {
      await writeEmployeeIdentityAuditSafely({
        tenantId: context.session.tenantId,
        actorId: context.session.userId,
        correlationId: context.correlationId,
        action: "rh.employee_identity.delete.rejected.v1",
        resourceId: employeeId,
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
          "Falha ao remover colaborador funcional.",
          context.correlationId,
        ),
        { status: 500 },
      ),
      context.correlationId,
    );
  }
}
