import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPlaytestDecisionGate,
  formatPlaytestDecisionGateLogEntry,
  parsePlaytestTriageReportMarkdown,
  upsertDecisionGateLogEntry,
  upsertDecisionGateInSprintStatus,
  validatePlaytestDecisionGateReport,
} from "@/lib/observability/playtest-evidence";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const sourceReport =
    readArg("--source-report") ??
    path.join(process.cwd(), "_bmad-output/implementation-artifacts/playtest-triage-report.md");
  const decisionLog =
    readArg("--decision-log") ??
    path.join(process.cwd(), "_bmad-output/implementation-artifacts/decision-gate-log.md");
  const sprintStatus =
    readArg("--sprint-status") ??
    path.join(process.cwd(), "_bmad-output/implementation-artifacts/sprint-status.yaml");
  const storyId = readArg("--story-id") ?? "9.4";
  const storyKey =
    readArg("--story-key") ?? "9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo";
  const recordedAt = readArg("--recorded-at") ?? new Date().toISOString();

  const reportMarkdown = await readFile(sourceReport, "utf8");
  const report = parsePlaytestTriageReportMarkdown(reportMarkdown);
  const validationIssues = validatePlaytestDecisionGateReport(report);
  if (validationIssues.length > 0) {
    throw new Error(
      `Relatorio de playtesting nao elegivel para gate final: ${validationIssues
        .map((issue) => issue.message)
        .join(" | ")}`,
    );
  }
  const gate = buildPlaytestDecisionGate(report);

  const logEntry = formatPlaytestDecisionGateLogEntry(gate, report, {
    storyId,
    storyKey,
    sourceReportPath: path.relative(process.cwd(), sourceReport),
    recordedAt,
  });
  const existingLog = await readFile(decisionLog, "utf8").catch(() => "# Decision Gate Log\n\n");
  const nextLog = upsertDecisionGateLogEntry(existingLog, logEntry, {
    storyId,
    storyKey,
  });

  const sprintStatusContent = await readFile(sprintStatus, "utf8");
  const nextSprintStatus = upsertDecisionGateInSprintStatus(sprintStatusContent, gate, {
    sourceStory: storyKey,
    sourceReport: path.relative(process.cwd(), sourceReport),
    recordedAt,
  });

  await mkdir(path.dirname(decisionLog), { recursive: true });
  await writeFile(decisionLog, nextLog, "utf8");
  await writeFile(sprintStatus, nextSprintStatus, "utf8");

  console.log(`Decision gate emitido: ${gate.recommendation}`);
  console.log(`Proximo ciclo: ${gate.next_cycle_action}`);
  console.log(`Log atualizado em: ${decisionLog}`);
  console.log(`Sprint status atualizado em: ${sprintStatus}`);
}

main().catch((error) => {
  console.error("[decision-gate] Falha ao emitir recomendacao final", error);
  process.exit(1);
});
