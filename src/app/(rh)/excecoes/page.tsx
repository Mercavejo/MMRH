import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { ExceptionQueuePage } from "@/components/exceptions/ExceptionQueuePage";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { exceptionPriorities, exceptionStates, type ExceptionPriority, type ExceptionState } from "@/modules/exceptions/domain/exception";
import { listBatchExceptions } from "@/modules/exceptions/application/list-exceptions";
import { ExceptionWorkflowError } from "@/modules/exceptions/infrastructure/exception-repository";

type RhExceptionsSearchParams = {
  batchId?: string;
  priority?: string;
  state?: string;
  skip?: string;
  take?: string;
};

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

function parseEnumValue<T extends readonly string[]>(value: string | undefined, allowed: T): T[number] | undefined {
  if (!value) {
    return undefined;
  }

  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : undefined;
}

async function loadInitialQueue(searchParams?: RhExceptionsSearchParams) {
  const batchId = searchParams?.batchId?.trim() ?? "";
  const priority = parseEnumValue(searchParams?.priority, exceptionPriorities);
  const state = parseEnumValue(searchParams?.state, exceptionStates);
  const skip = Number.parseInt(searchParams?.skip ?? "0", 10);
  const take = Number.parseInt(searchParams?.take ?? "20", 10);

  if (!batchId) {
    return { initialBatchId: "", initialErrorMessage: null };
  }

  const sessionToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return { initialBatchId: batchId, initialErrorMessage: "Sessao ausente." };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return { initialBatchId: batchId, initialErrorMessage: "Sessao invalida ou expirada." };
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return { initialBatchId: batchId, initialErrorMessage: "Usuario sem permissao no tenant." };
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });

    if (role !== "rh_operator") {
      return { initialBatchId: batchId, initialErrorMessage: "Somente RH operador pode consultar excecoes." };
    }

    const result = await listBatchExceptions({
      tenantId: session.tenantId,
      batchId,
      priority: priority as ExceptionPriority | undefined,
      state: state as ExceptionState | undefined,
      skip: Number.isFinite(skip) && skip >= 0 ? skip : 0,
      take: Number.isFinite(take) && take > 0 ? Math.min(take, 100) : 20,
    });

    return {
      initialBatchId: batchId,
      initialItems: result.exceptions,
      initialMetadata: result.metadata,
      initialErrorMessage: null,
      initialFilters: {
        batchId,
        priority: priority ?? "",
        state: state ?? "",
        skip: Number.isFinite(skip) && skip >= 0 ? skip : 0,
        take: Number.isFinite(take) && take > 0 ? Math.min(take, 100) : 20,
      },
    };
  } catch (error) {
    if (error instanceof ExceptionWorkflowError || error instanceof Error) {
      return { initialBatchId: batchId, initialErrorMessage: error.message };
    }

    return { initialBatchId: batchId, initialErrorMessage: "Falha ao carregar fila de excecoes." };
  }
}

export default async function RhExceptionsPage({ searchParams }: { searchParams?: RhExceptionsSearchParams }) {
  const initial = await loadInitialQueue(searchParams);

  return (
    <ExceptionQueuePage
      initialBatchId={initial.initialBatchId}
      initialItems={initial.initialItems}
      initialMetadata={initial.initialMetadata}
      initialErrorMessage={initial.initialErrorMessage}
      initialFilters={initial.initialFilters}
    />
  );
}