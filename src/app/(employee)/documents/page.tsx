import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import {
  listEmployeeDocuments,
  type EmployeeDocumentListItem,
} from "@/lib/documents/list-documents";
import { EmployeeDocumentsPageView } from "./DocumentsList";

export {
  EmployeeDocumentsPageView,
  getContestationGuidanceByStatus,
  serializeDocumentFilters,
} from "./DocumentsList";

type SearchParams = {
  period_ref?: string;
  document_type?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export const dynamic = "force-dynamic";

async function resolveRole(userId: string, tenantId: string) {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, userId),
        eq(userTenantMappings.tenantId, tenantId),
      ),
    )
    .limit(1);

  return mappings[0]?.role;
}

export default async function EmployeeDocumentsPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const periodRef = query.period_ref;
  const documentType = query.document_type;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return (
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef, documentType }}
        errorMessage="Sessão ausente. Realize login para consultar seus documentos."
      />
    );
  }

  const session = await validateSession(token);
  if (!session) {
    return (
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef, documentType }}
        errorMessage="Sessão inválida ou expirada. Realize login novamente."
      />
    );
  }

  const role = await resolveRole(session.userId, session.tenantId);

  if (role !== "colaborador") {
    return (
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef, documentType }}
        errorMessage="Acesso permitido somente para colaborador."
      />
    );
  }

  let items: EmployeeDocumentListItem[] = [];
  let errorMessage: string | undefined;

  try {
    items = await listEmployeeDocuments({
      tenantId: session.tenantId,
      userId: session.userId,
      periodRef,
      documentType,
    });
  } catch {
    errorMessage = "Falha ao carregar documentos. Tente novamente em instantes.";
  }

  return (
    <EmployeeDocumentsPageView
      items={items}
      activeFilters={{ periodRef, documentType }}
      errorMessage={errorMessage}
    />
  );
}
