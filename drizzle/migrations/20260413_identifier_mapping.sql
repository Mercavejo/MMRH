DO $$ BEGIN
  ALTER TYPE "external_ingestion_failure_code" ADD VALUE IF NOT EXISTS 'MAPPING_NOT_FOUND';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "external_ingestion_failure_code" ADD VALUE IF NOT EXISTS 'AMBIGUOUS_ASSOCIATION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "external_ingestion_mapping_status" AS ENUM('mapped', 'ambiguous', 'not-found');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "external_ingestions"
  ADD COLUMN IF NOT EXISTS "mapping_status" "external_ingestion_mapping_status" NOT NULL DEFAULT 'not-found',
  ADD COLUMN IF NOT EXISTS "mapping_version" integer,
  ADD COLUMN IF NOT EXISTS "mapped_employee_id" uuid,
  ADD COLUMN IF NOT EXISTS "external_identifier" text;

DO $$ BEGIN
  CREATE TYPE "external_identifier_mapping_change_type" AS ENUM('create', 'update', 'disable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "external_identifier_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,
  "source_system" text NOT NULL,
  "external_identifier" text NOT NULL,
  "employee_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "mapping_version" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "change_type" "external_identifier_mapping_change_type" NOT NULL,
  "changed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "correlation_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ext_identifier_map_tenant_source_external_ver_uidx"
  ON "external_identifier_mappings" ("tenant_id", "source_system", "external_identifier", "mapping_version");

CREATE UNIQUE INDEX IF NOT EXISTS "ext_identifier_map_tenant_source_external_active_uidx"
  ON "external_identifier_mappings" ("tenant_id", "source_system", "external_identifier")
  WHERE "is_active" = true;
