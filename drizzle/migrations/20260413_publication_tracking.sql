CREATE TYPE "batch_publication_status" AS ENUM ('pending', 'publishing', 'published', 'failed');
--> statement-breakpoint
ALTER TABLE "batches"
  ADD COLUMN "publication_status" "batch_publication_status" DEFAULT 'pending' NOT NULL,
  ADD COLUMN "publication_attempts" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "published_at" timestamp with time zone,
  ADD COLUMN "published_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "last_publication_correlation_id" uuid,
  ADD COLUMN "last_publication_idempotency_key" text,
  ADD COLUMN "last_publication_error" text;