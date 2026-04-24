import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { eq, inArray } from "drizzle-orm";
import { spawnSync } from "child_process";

const DEMO_TENANT_SLUG = "demo-playtesting-tenant";
const DEMO_EMAILS = ["admin@demo.com", "gestor@demo.com", "colaborador@demo.com"];

async function main() {
  const { db }   = await import("../../src/lib/db/client");
  const { tenants, users, userTenantMappings, batches, employeeDocuments, auditLogs } =
    await import("../../src/lib/db/schema");

  console.log("🧹 Iniciando reset de playtesting...");

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
    .where(inArray(users.email, DEMO_EMAILS));

  if (remainingUsers.length > 0) {
    const ids = remainingUsers.map((u) => u.id);
    await db.delete(userTenantMappings).where(inArray(userTenantMappings.userId, ids));
    await db.delete(users).where(inArray(users.email, DEMO_EMAILS));
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
