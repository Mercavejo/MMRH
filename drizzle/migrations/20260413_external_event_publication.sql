DO $$ BEGIN
  CREATE TYPE "external_event_delivery_status" AS ENUM ('pending', 'delivering', 'delivered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "external_event_delivery_failure_code" AS ENUM (
    'FORBIDDEN_CONSUMER',
    'CONSUMER_CONFIGURATION_MISSING',
    'TRANSPORT_FAILURE',
    'RETRY_EXHAUSTED',
    'INVALID_EVENT_PAYLOAD'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_event_consumers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,
  "consumer_key" text NOT NULL,
  "event_name" text NOT NULL,
  "event_version" text NOT NULL DEFAULT 'v1',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_event_consumers_tenant_consumer_event_uidx"
  ON "external_event_consumers" ("tenant_id", "consumer_key", "event_name", "event_version");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_event_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,
  "consumer_key" text NOT NULL,
  "event_name" text NOT NULL,
  "event_version" text NOT NULL DEFAULT 'v1',
  "source_reference" text NOT NULL,
  "fingerprint" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "external_event_delivery_status" NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "last_attempt_at" timestamp with time zone,
  "last_error" text,
  "failure_code" "external_event_delivery_failure_code",
  "recommended_action" text,
  "payload_summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "correlation_id" uuid NOT NULL,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_event_deliveries_tenant_consumer_fingerprint_uidx"
  ON "external_event_deliveries" ("tenant_id", "consumer_key", "fingerprint");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_event_deliveries_tenant_event_idempotency_uidx"
  ON "external_event_deliveries" ("tenant_id", "event_name", "idempotency_key");