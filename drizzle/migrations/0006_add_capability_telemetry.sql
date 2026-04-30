CREATE TABLE IF NOT EXISTS "tenant_capability_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"plan_code" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"period" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_count_non_negative" CHECK (usage_count >= 0),
	CONSTRAINT "period_format_check" CHECK (period ~ '^\d{4}-\d{2}$')
);
--> statement-breakpoint
ALTER TABLE "tenant_capability_usage" ADD CONSTRAINT "tenant_capability_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_capability_period" ON "tenant_capability_usage" ("tenant_id","capability","period","plan_code");