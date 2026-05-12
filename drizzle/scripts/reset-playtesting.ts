import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { eq, inArray } from "drizzle-orm";
import { spawnSync } from "child_process";

const DEMO_TENANT_SLUG = "demo-playtesting-tenant";
const DEMO_CPFS = ["11111111111", "22222222222", "33333333333"];

async function main() {
  const { db }   = await import("../../src/lib/db/client");
  const { sql } = await import("drizzle-orm");
  const { tenants, users, userTenantMappings, batches, employeeDocuments, employeeIdentities, auditLogs } =
    await import("../../src/lib/db/schema");

  console.log("🧹 Iniciando reset de playtesting...");

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

  // ── 1. Descobrir tenant demo ───────────────────────────────────────────────
  const [demoTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, DEMO_TENANT_SLUG))
    .limit(1);

  if (demoTenant) {
    const tenantId = demoTenant.id;

    // ── 2. Apagar dados do tenant em ordem segura (respeita FKs RESTRICT) ──
    console.log(`>> Removendo dados do tenant ${tenantId}...`);

    await db.delete(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId));

    await db.delete(employeeDocuments)
      .where(eq(employeeDocuments.tenantId, tenantId));

    await db.delete(employeeIdentities)
      .where(eq(employeeIdentities.tenantId, tenantId));

    await db.delete(batches)
      .where(eq(batches.tenantId, tenantId));

    await db.delete(userTenantMappings)
      .where(eq(userTenantMappings.tenantId, tenantId));

    await db.delete(tenants)
      .where(eq(tenants.id, tenantId));

    console.log(">> Tenant e dados removidos com sucesso.");
  } else {
    console.log(">> Tenant demo não encontrado. Continuando...");
  }

  // ── 3. Remover usuários demo (podem sobrar de runs parciais) ──────────────
  const remainingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.cpf, DEMO_CPFS));

  if (remainingUsers.length > 0) {
    const ids = remainingUsers.map((u) => u.id);
    await db.delete(userTenantMappings).where(inArray(userTenantMappings.userId, ids));
    await db.delete(users).where(inArray(users.cpf, DEMO_CPFS));
    console.log(">> Usuários demo removidos.");
  }

  // ── 4. Invocar seed ───────────────────────────────────────────────────────
  console.log("🌱 Invocando script de seed...");

  const result = spawnSync(
    "npx",
    ["tsx", "drizzle/scripts/seed-playtesting.ts"],
    {
      stdio: "inherit",
      shell: true,       // let the OS shell resolve npx/.cmd on Windows
      timeout: 60_000,   // 60 s — prevent indefinite hang
    },
  );

  if (result.status !== 0) {
    console.error("❌ Erro ao rodar seed! Status:", result.status);
    if (result.error) console.error(result.error);
    process.exit(1);
  }

  console.log("✅ Reset concluído com sucesso.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro no script de reset:", err);
  process.exit(1);
});
