import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  buildPlaytestEvidencePackage,
  filterAdminEventsByActorSession,
  formatPlaytestEvidencePackageAsMarkdown,
  listPlaytestAuditEvents,
  type PlaytestEvidenceMode,
  type PlaytestEvidenceRole,
} from "@/lib/observability/playtest-evidence";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function parseDateArg(flag: string): Date | undefined {
  const value = readArg(flag);
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flag} invalido.`);
  }

  return parsed;
}

function parseModeArg(): PlaytestEvidenceMode {
  const mode = readArg("--mode");
  if (!mode || mode === "client" || mode === "admin") {
    return (mode ?? "client") as PlaytestEvidenceMode;
  }

  throw new Error("--mode invalido. Use client ou admin.");
}

function parseRoleArg(): PlaytestEvidenceRole | undefined {
  const role = readArg("--role");
  if (!role) {
    return undefined;
  }

  if (
    role === "gestor_cliente" ||
    role === "colaborador" ||
    role === "admin_plataforma" ||
    role === "suporte" ||
    role === "rh_gestor" ||
    role === "rh_operator" ||
    role === "desconhecido"
  ) {
    return role;
  }

  throw new Error("--role invalido.");
}

function parseFormatArg(): "markdown" | "json" {
  const format = readArg("--format");
  if (!format || format === "markdown" || format === "json") {
    return (format ?? "markdown") as "markdown" | "json";
  }

  throw new Error("--format invalido. Use markdown ou json.");
}

async function main() {
  const { db } = await import("../../src/lib/db/client");
  const { tenants, users } = await import("../../src/lib/db/schema");

  const tenantSlug = readArg("--tenant-slug") ?? "demo-playtesting-tenant";
  const actorEmail = readArg("--actor-email");
  const mode = parseModeArg();
  const roleFilter = parseRoleArg();
  const format = parseFormatArg();
  const correlationId = readArg("--correlation-id");
  const from = parseDateArg("--from");
  const to = parseDateArg("--to");
  const output =
    readArg("--output") ??
    path.join(
      process.cwd(),
      "docs/playtesting",
      `evidence-${new Date().toISOString().replaceAll(":", "-")}.${format === "json" ? "json" : "md"}`,
    );

  const [tenant] = await db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) {
    throw new Error(`Tenant nao encontrado para slug ${tenantSlug}.`);
  }

  const [actor] = actorEmail
    ? await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, actorEmail))
        .limit(1)
    : [];

  if (actorEmail && !actor) {
    throw new Error(`Usuario nao encontrado para email ${actorEmail}.`);
  }

  const baseEvents = await listPlaytestAuditEvents({
    tenantId: tenant.id,
    from,
    to,
    correlationId,
  });

  const events =
    mode === "admin" && actor?.id
      ? filterAdminEventsByActorSession(baseEvents, actor.id)
      : actor?.id
        ? baseEvents.filter((event) => event.actor_id === actor.id)
        : baseEvents;

  const pkg = buildPlaytestEvidencePackage({
    tenantId: tenant.id,
    actorId: actor?.id ?? null,
    mode,
    roleFilter,
    sessionLabel: [
      `tenant=${tenant.slug}`,
      `mode=${mode}`,
      roleFilter ? `role=${roleFilter}` : "roles=all",
      actorEmail ? `actor=${actorEmail}` : "actors=all",
    ].join("; "),
    events,
  });

  const content =
    format === "json"
      ? `${JSON.stringify(pkg, null, 2)}\n`
      : formatPlaytestEvidencePackageAsMarkdown(pkg);

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, content, "utf8");

  console.log(`Pacote exportado em: ${output}`);
  console.log(
    `Etapas cobertas: ${pkg.covered_steps.length}/${pkg.covered_steps.length + pkg.missing_steps.length}`,
  );
}

main().catch((error) => {
  console.error("[playtest-evidence] Falha ao exportar evidencias", error);
  process.exit(1);
});
