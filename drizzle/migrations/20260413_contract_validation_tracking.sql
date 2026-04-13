ALTER TYPE "external_ingestion_failure_code" ADD VALUE IF NOT EXISTS 'INVALID_CONTRACT_VERSION';
--> statement-breakpoint
CREATE TYPE "external_ingestion_validation_result" AS ENUM ('success', 'failure');
--> statement-breakpoint
ALTER TABLE "external_ingestions"
  ADD COLUMN "contract_version" text DEFAULT 'v1' NOT NULL,
  ADD COLUMN "validation_result" "external_ingestion_validation_result" DEFAULT 'success' NOT NULL,
  ADD COLUMN "validation_failure_code" "external_ingestion_failure_code",
  ADD COLUMN "validated_at" timestamp with time zone DEFAULT now() NOT NULL;