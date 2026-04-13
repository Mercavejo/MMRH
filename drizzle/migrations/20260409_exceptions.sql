CREATE TYPE "public"."exception_error_category" AS ENUM('not-found', 'invalid-format', 'ambiguous-routing', 'other');--> statement-breakpoint
CREATE TYPE "public"."exception_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."exception_state" AS ENUM('pending', 'in-treatment', 'resolved', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."exception_correction_result" AS ENUM('reprocessable', 'reject', 'publish-with-evidence');--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_external_id" text NOT NULL,
	"associated_employee_id" uuid,
	"assoc_employee_external_id" text,
	"routing_ambiguity_details" jsonb,
	"error_category" "public"."exception_error_category" DEFAULT 'other' NOT NULL,
	"priority" "public"."exception_priority" DEFAULT 'medium' NOT NULL,
	"current_state" "public"."exception_state" DEFAULT 'pending' NOT NULL,
	"recommended_action" text,
	"correction_applied" text,
	"correction_result" "public"."exception_correction_result",
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exception_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exception_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action_description" text NOT NULL,
	"expected_result" "public"."exception_correction_result",
	"actor_id" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_associated_employee_id_users_id_fk" FOREIGN KEY ("associated_employee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_actions" ADD CONSTRAINT "exception_actions_exception_id_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_actions" ADD CONSTRAINT "exception_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_actions" ADD CONSTRAINT "exception_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exceptions_batch_tenant_idx" ON "exceptions" USING btree ("batch_id","tenant_id");--> statement-breakpoint
CREATE INDEX "exceptions_tenant_state_idx" ON "exceptions" USING btree ("tenant_id","current_state");--> statement-breakpoint
CREATE INDEX "exceptions_tenant_priority_idx" ON "exceptions" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "exception_actions_exception_idx" ON "exception_actions" USING btree ("exception_id");--> statement-breakpoint