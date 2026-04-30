import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPlaytestTriageReport,
  formatPlaytestTriageReportAsMarkdown,
  parsePlaytestEvidenceMarkdown,
  type PlaytestEvidencePackage,
  type PlaytestHumanEvidenceEntry,
} from "@/lib/observability/playtest-evidence";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function readTechnicalPackage(filePath: string | undefined): Promise<PlaytestEvidencePackage[]> {
  if (!filePath) {
    return [];
  }

  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as PlaytestEvidencePackage | PlaytestEvidencePackage[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function readHumanEntries(
  filePath: string | undefined,
  mode: "client" | "admin",
  sourceLabel: string,
): Promise<PlaytestHumanEvidenceEntry[]> {
  if (!filePath) {
    return [];
  }

  const content = await readFile(filePath, "utf8");
  return parsePlaytestEvidenceMarkdown(content, {
    mode,
    sourceLabel,
  });
}

async function main() {
  const roundLabel = readArg("--round-label") ?? "rodada-playtesting";
  const output =
    readArg("--output") ??
    path.join(process.cwd(), "_bmad-output/implementation-artifacts/playtest-triage-report.md");

  const technicalPackages = [
    ...(await readTechnicalPackage(readArg("--client-technical"))),
    ...(await readTechnicalPackage(readArg("--admin-technical"))),
  ];

  const humanEntries = [
    ...(await readHumanEntries(readArg("--client-human"), "client", "client-human")),
    ...(await readHumanEntries(readArg("--admin-human"), "admin", "admin-human")),
  ];

  const report = buildPlaytestTriageReport({
    roundLabel,
    technicalPackages,
    humanEntries,
  });

  const markdown = formatPlaytestTriageReportAsMarkdown(report);

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, markdown, "utf8");

  console.log(`Consolidacao exportada em: ${output}`);
  console.log(
    `Buckets => bloqueador=${report.summary.counts.bloqueador}, melhoria_antes_da_proxima_demo=${report.summary.counts.melhoria_antes_da_proxima_demo}, futuro_backlog=${report.summary.counts.futuro_backlog}`,
  );
}

main().catch((error) => {
  console.error("[playtest-triage] Falha ao consolidar rodada", error);
  process.exit(1);
});
