import { loadEnvConfig } from "@next/env";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const POLL_INTERVAL_MS = 5_000;
const MAX_CONCURRENT = 1;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL, {
    max: 2,
    prepare: false,
    ssl: "require",
  });

  const schema = await import("../src/lib/db/schema");
  const db = drizzle(client, { schema });
  const {
    batches,
  } = schema;

  console.log("[ocr-worker] Worker iniciado. Polling a cada", POLL_INTERVAL_MS / 1000, "segundos.");

  for (;;) {
    let processed = 0;

    try {
      const pendingBatches = await db
        .select({
          id: batches.id,
          tenantId: batches.tenantId,
          validationSummary: batches.validationSummary,
          sourceContentBase64: batches.sourceContentBase64,
          originalFilename: batches.originalFilename,
          mimeType: batches.mimeType,
        })
        .from(batches)
        .where(
          sql`${batches.validationSummary}->>'ocr_pending' = 'true'`,
        )
        .limit(MAX_CONCURRENT);

      for (const batch of pendingBatches) {
        const sourceBase64 = batch.sourceContentBase64;

        if (!sourceBase64) {
          console.warn("[ocr-worker] Batch sem conteudo:", batch.id);
          continue;
        }

        console.log("[ocr-worker] Processando batch:", batch.id);

        try {
          const fileBuffer = Buffer.from(sourceBase64, "base64");
          const file = new File([fileBuffer], batch.originalFilename, {
            type: batch.mimeType || "application/pdf",
          });

          const { validateBatchImportFile } = await import(
            "../src/lib/rh/batches/import-validation"
          );

          const summary =
            batch.validationSummary as Record<string, unknown> | null;
          const documentTypeHint =
            summary?.document_type_hint as string | undefined;

          const validation = await validateBatchImportFile(file, {
            pdfDocumentTypeHint:
              documentTypeHint === "cartao_ponto" ? "cartao_ponto" : undefined,
          });

          const { buildBatchRoutingManifest } = await import(
            "../src/lib/rh/batches/batch-routing"
          );

          const routingManifest = buildBatchRoutingManifest({
            batchId: batch.id,
            rows: validation.rows,
          });

          const updatedSummary = {
            ...validation.summary,
            document_type_hint:
              validation.summary.document_type_hint ?? documentTypeHint,
            ocr_used: validation.summary.ocr_used,
            ocr_average_confidence: validation.summary.ocr_average_confidence,
            ocr_pending: false,
          };

          await db
            .update(batches)
            .set({
              validationStatus: validation.validation_status,
              validationSummary: updatedSummary,
              routingManifest,
              routingTotalCount: routingManifest.length,
              routingPendingCount: routingManifest.length,
              routingMatchedCount: 0,
              routingFailedCount: 0,
              routingAmbiguousCount: 0,
              routingBlockedReason: null,
              routingProcessedAt: null,
              updatedAt: new Date(),
            })
            .where(
              eq(batches.id, batch.id),
            );

          processed += 1;

          console.log(
            "[ocr-worker] Batch processado:",
            batch.id,
            validation.is_valid ? "VALIDO" : "BLOQUEADO",
            validation.summary.total_rows,
            "linhas",
          );
        } catch (error) {
          console.error("[ocr-worker] Erro ao processar batch:", batch.id, error);

          await db
            .update(batches)
            .set({
              validationStatus: "blocked",
              validationSummary: {
                source_format: "pdf",
                total_rows: 0,
                valid_rows: 0,
                invalid_rows: 0,
                critical_issue_count: 1,
                warning_issue_count: 0,
                issues: [
                  {
                    code: "OCR_WORKER_ERROR",
                    message:
                      "Falha ao processar OCR. Tente novamente.",
                    severity: "critical",
                  },
                ],
                ocr_pending: false,
              },
              updatedAt: new Date(),
            })
            .where(
              eq(batches.id, batch.id),
            );
        }
      }
    } catch (error) {
      console.error("[ocr-worker] Erro no poll:", error);
    }

    if (processed === 0) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

main().catch((error) => {
  console.error("[ocr-worker] Erro fatal:", error);
  process.exit(1);
});
