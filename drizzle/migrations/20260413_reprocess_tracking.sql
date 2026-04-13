ALTER TABLE "exceptions"
  ADD COLUMN "reprocess_attempts" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "last_reprocess_at" timestamp with time zone,
  ADD COLUMN "last_reprocess_correlation_id" uuid,
  ADD COLUMN "last_reprocess_idempotency_key" text;
--> statement-breakpoint
CREATE INDEX "exceptions_reprocess_idem_idx" ON "exceptions" USING btree ("tenant_id", "batch_id", "last_reprocess_idempotency_key");
--> statement-breakpoint
