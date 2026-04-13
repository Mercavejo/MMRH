CREATE TABLE IF NOT EXISTS "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_code" text NOT NULL,
  "display_name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plans_plan_code_uidx"
  ON "plans" ("plan_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_plan_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE restrict,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_to" timestamp with time zone,
  "changed_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "changed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "correlation_id" uuid NOT NULL,
  "change_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_plan_assignments_active_tenant_uidx"
  ON "tenant_plan_assignments" ("tenant_id")
  WHERE "effective_to" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_plan_assignments_tenant_window_idx"
  ON "tenant_plan_assignments" ("tenant_id", "effective_from", "effective_to");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_plan_assignment_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assignment_id" uuid NOT NULL REFERENCES "tenant_plan_assignments"("id") ON DELETE restrict,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE restrict,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_to" timestamp with time zone,
  "changed_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "changed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "correlation_id" uuid NOT NULL,
  "change_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_plan_assignment_history_assignment_changed_at_idx"
  ON "tenant_plan_assignment_history" ("assignment_id", "changed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_plan_assignment_history_tenant_changed_at_idx"
  ON "tenant_plan_assignment_history" ("tenant_id", "changed_at");
