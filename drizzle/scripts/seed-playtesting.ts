import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";

// ─── Config ──────────────────────────────────────────────────────────────────
const DEMO_TENANT_SLUG = "demo-playtesting-tenant";
const DEMO_TENANT_NAME = "Empresa Demo S/A";
const ADMIN_EMAIL = "admin@demo.com";
const GESTOR_EMAIL = "gestor@demo.com";
const COLAB_EMAIL = "colaborador@demo.com";
const PLAYTESTING_EMPLOYEE_IDENTITIES = [
  { referenceCode: "0091", employeeName: "Marcelo Aparecido Pereira dos Santos" },
  { referenceCode: "0179", employeeName: "Valdemar Aragao Bastos" },
  { referenceCode: "0212", employeeName: "Moises Ignacio Garcia" },
  { referenceCode: "0227", employeeName: "Josivaldo Bento da Silva" },
  { referenceCode: "0251", employeeName: "Mauricio Alves" },
  { referenceCode: "0285", employeeName: "Genivaldo Jesus de Araujo" },
  { referenceCode: "0317", employeeName: "Antonio Marcos Laurentino" },
  { referenceCode: "0322", employeeName: "Marco Antonio Fransioci" },
] as const;
// Password can be overridden via PLAYTESTING_PASSWORD env var
const DEMO_PASSWORD = process.env.PLAYTESTING_PASSWORD ?? "SenhaSegura123!";

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { db }   = await import("../../src/lib/db/client");
  const schema   = await import("../../src/lib/db/schema");
  const {
    tenants, users, userTenantMappings,
    batches, employeeDocuments, employeeIdentities, auditLogs,
  } = schema;

  console.log("🌱 Iniciando seed para playtesting...");

  // ── 1. Idempotency check ──────────────────────────────────────────────────
  const existingTenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, DEMO_TENANT_SLUG))
    .limit(1);

  if (existingTenant.length > 0) {
    console.log("⚠️  Tenant demo já existe. Execute reset-playtesting primeiro.");
    process.exit(0);
  }

  // ── 1b. Schema bootstrap (idempotente) ────────────────────────────────────
  // Garante que o enum e a coluna estejam presentes mesmo antes de `drizzle-kit migrate`.
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`ALTER TYPE "public"."batch_source_format" ADD VALUE IF NOT EXISTS 'pdf'`);
  await db.execute(sql`
    ALTER TABLE "batches"
    ADD COLUMN IF NOT EXISTS "source_storage_key" text,
    ADD COLUMN IF NOT EXISTS "source_storage_filename" text,
    ADD COLUMN IF NOT EXISTS "source_storage_mime_type" text
  `);
  await db.execute(sql`ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "batch_id" uuid REFERENCES "public"."batches"("id") ON DELETE SET NULL`);
  await db.execute(sql`
    ALTER TABLE "employee_documents"
    ADD COLUMN IF NOT EXISTS "storage_key" text,
    ADD COLUMN IF NOT EXISTS "file_name" text,
    ADD COLUMN IF NOT EXISTS "mime_type" text,
    ADD COLUMN IF NOT EXISTS "source_page_index" integer
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_identity_status') THEN
        CREATE TYPE "public"."employee_identity_status" AS ENUM ('pending_activation', 'active', 'blocked', 'inactive');
      END IF;
    END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "employee_identities" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE restrict,
      "user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
      "reference_code" text NOT NULL,
      "employee_name" text NOT NULL,
      "admission_date" text NOT NULL,
      "status" "public"."employee_identity_status" NOT NULL DEFAULT 'pending_activation',
      "notes" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "employee_identities_tenant_reference_unique"
    ON "employee_identities" ("tenant_id", "reference_code")
  `);


  // ── 2. Tenant ─────────────────────────────────────────────────────────────
  console.log(">> Criando tenant de demonstração...");
  const [tenant] = await db.insert(tenants).values({
    name: DEMO_TENANT_NAME,
    slug: DEMO_TENANT_SLUG,
    isActive: true,
  }).returning();

  // ── 3. Usuários ───────────────────────────────────────────────────────────
  console.log(">> Criando usuários...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Delete leftover demo users from a previous partial run (no tenant yet)
  await db.delete(users).where(inArray(users.email, [ADMIN_EMAIL, GESTOR_EMAIL, COLAB_EMAIL]));

  const [admin] = await db.insert(users).values({
    email: ADMIN_EMAIL,
    name: "Admin Mercavejo (Playtesting)",
    passwordHash,
    isActive: true,
  }).returning();

  const [gestor] = await db.insert(users).values({
    email: GESTOR_EMAIL,
    name: "Gestor Cliente (Playtesting)",
    passwordHash,
    isActive: true,
  }).returning();

  const [colaborador] = await db.insert(users).values({
    email: COLAB_EMAIL,
    name: "Colaborador (Playtesting)",
    passwordHash,
    isActive: true,
  }).returning();

  // ── 4. Mapeamentos de perfil ───────────────────────────────────────────────
  console.log(">> Mapeando papéis dos usuários...");
  await db.insert(userTenantMappings).values([
    { userId: admin.id, tenantId: tenant.id, role: "admin_plataforma" },
    { userId: gestor.id,      tenantId: tenant.id, role: "rh_gestor"   },
    { userId: colaborador.id, tenantId: tenant.id, role: "colaborador" },
  ]);

  // ── 4b. Identidades funcionais para roteamento/publicacao do demo ────────
  console.log(">> Criando identidades funcionais de playtesting...");
  await db.insert(employeeIdentities).values(
    PLAYTESTING_EMPLOYEE_IDENTITIES.map((item) => ({
      tenantId: tenant.id,
      userId: colaborador.id,
      referenceCode: item.referenceCode,
      employeeName: item.employeeName,
      admissionDate: "2024-01-01",
      status: "active" as const,
      notes: "Auto-seed para fluxo PDF de playtesting.",
    })),
  );

  // ── 5. Lotes (3 com status distintos) ────────────────────────────────────
  console.log(">> Criando lotes...");
  const corrIds = [randomUUID(), randomUUID(), randomUUID()];

  const [lotePublicado, loteProcessando, loteExcecao] = await db
    .insert(batches)
    .values([
      // Lote 1 — publicado
      {
        tenantId: tenant.id,
        uploadedBy: gestor.id,
        originalFilename: "holerites_abril_2026_validados.pdf",
        fileSizeBytes: 2_048_576,
        mimeType: "application/pdf",
        sourceFormat: "pdf",
        validationStatus: "validated",
        validationSummary: { status: "ok", checked_items: 20 },
        routingStatus: "completed",
        routingTotalCount: 20,
        routingMatchedCount: 20,
        publicationStatus: "published",
        correlationId: corrIds[0],
      },
      // Lote 2 — processando
      {
        tenantId: tenant.id,
        uploadedBy: gestor.id,
        originalFilename: "ponto_abril_2026.pdf",
        fileSizeBytes: 5_120_000,
        mimeType: "application/pdf",
        sourceFormat: "pdf",
        validationStatus: "validated",
        validationSummary: { status: "ok", checked_items: 50 },
        routingStatus: "processing",
        routingTotalCount: 50,
        routingPendingCount: 50,
        publicationStatus: "pending",
        correlationId: corrIds[1],
      },
      // Lote 3 — com exceções (ambiguous routing)
      {
        tenantId: tenant.id,
        uploadedBy: gestor.id,
        originalFilename: "adicionais_marco_2026.pdf",
        fileSizeBytes: 1_024_000,
        mimeType: "application/pdf",
        sourceFormat: "pdf",
        validationStatus: "validated",
        validationSummary: { status: "warnings", checked_items: 15 },
        routingStatus: "completed",
        routingTotalCount: 15,
        routingMatchedCount: 10,
        routingAmbiguousCount: 5,
        publicationStatus: "pending",
        correlationId: corrIds[2],
      },
    ])
    .returning();

  // ── 6. Documentos (vinculados por batchId) ────────────────────────────────
  console.log(">> Inserindo documentos...");

  // Lote 1 publicado — 20 docs: 5 do colaborador, 15 do gestor
  const docsLote1 = Array.from({ length: 20 }, (_, i) => ({
    tenantId: tenant.id,
    batchId:  lotePublicado.id,
    userId:   i < 5 ? colaborador.id : gestor.id,
    documentType: "holerite",
    periodRef:    "2026-04",
    status:       "published" as const,
  }));

  // Lote 2 processando — 50 docs pendentes
  const docsLote2 = Array.from({ length: 50 }, () => ({
    tenantId: tenant.id,
    batchId:  loteProcessando.id,
    userId:   gestor.id,
    documentType: "cartao_ponto",
    periodRef:    "2026-04",
    status:       "processing" as const,
  }));

  // Lote 3 com exceções — 15 docs (5 erro, 10 pendente)
  const docsLote3 = Array.from({ length: 15 }, (_, i) => ({
    tenantId: tenant.id,
    batchId:  loteExcecao.id,
    userId:   gestor.id,
    documentType: "outro",
    periodRef:    "2026-03",
    status:       (i < 5 ? "error" : "pending") as "error" | "pending",
  }));

  await db.insert(employeeDocuments).values([...docsLote1, ...docsLote2, ...docsLote3]);

  // ── 7. Eventos de auditoria (lotes + documentos) ──────────────────────────
  console.log(">> Criando logs de auditoria...");
  await db.insert(auditLogs).values([
    // Lote 1
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: lotePublicado.correlationId,
      action: "batch_upload", resourceType: "batch",
      resourceId: lotePublicado.id, status: "success",
      details: { filename: lotePublicado.originalFilename },
    },
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: lotePublicado.correlationId,
      action: "batch_publish", resourceType: "batch",
      resourceId: lotePublicado.id, status: "success",
      details: { items_published: 20 },
    },
    // Documento do colaborador acessado (AC #4 — documento)
    {
      tenantId: tenant.id, actorId: colaborador.id,
      correlationId: randomUUID(),
      action: "document_downloaded", resourceType: "document",
      resourceId: `${lotePublicado.id}::doc-0`, status: "success",
      details: { documentType: "holerite", periodRef: "2026-04" },
    },
    // Lote 2
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: loteProcessando.correlationId,
      action: "batch_upload", resourceType: "batch",
      resourceId: loteProcessando.id, status: "success",
      details: { filename: loteProcessando.originalFilename },
    },
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: loteProcessando.correlationId,
      action: "batch_routing_started", resourceType: "batch",
      resourceId: loteProcessando.id, status: "success",
      details: { total_items: 50 },
    },
    // Lote 3
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: loteExcecao.correlationId,
      action: "batch_upload", resourceType: "batch",
      resourceId: loteExcecao.id, status: "success",
      details: { filename: loteExcecao.originalFilename },
    },
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: loteExcecao.correlationId,
      action: "batch_process_exception", resourceType: "batch",
      resourceId: loteExcecao.id, status: "failure",
      details: { errors_found: 5, action_required: true },
    },
    // Documento com erro auditado (AC #4 — documento)
    {
      tenantId: tenant.id, actorId: gestor.id,
      correlationId: loteExcecao.correlationId,
      action: "document_routing_failed", resourceType: "document",
      resourceId: `${loteExcecao.id}::exc-0`, status: "failure",
      details: { reason: "ambiguous_identifier", periodRef: "2026-03" },
    },
  ]);

  console.log("\n✅ Seed finalizado com sucesso!");
  console.log("─────────────────────────────────────────");
  console.log(`Tenant: ${DEMO_TENANT_NAME} (${DEMO_TENANT_SLUG})`);
  console.log(`Documentos: ${docsLote1.length + docsLote2.length + docsLote3.length} total`);
  console.log("─────────────────────────────────────────");
  console.log("Credenciais:");
  console.log(`  Admin Mercavejo : ${ADMIN_EMAIL}`);
  console.log(`  Gestor Cliente : ${GESTOR_EMAIL}`);
  console.log(`  Colaborador : ${COLAB_EMAIL}`);
  console.log(`  Senha       : ${DEMO_PASSWORD}`);
  console.log("─────────────────────────────────────────");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro no script de seed:", err);
  process.exit(1);
});
