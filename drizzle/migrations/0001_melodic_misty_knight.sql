CREATE TYPE "public"."minimization_profile" AS ENUM('strict', 'standard');--> statement-breakpoint
CREATE TYPE "public"."compliance_evidence_status" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TABLE "compliance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"retention_days_documents" integer NOT NULL,
	"retention_days_audit_logs" integer NOT NULL,
	"legal_basis" text NOT NULL,
	"minimization_profile" "minimization_profile" DEFAULT 'standard' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_policies_retention_days_documents_range" CHECK ("retention_days_documents" >= 1 AND "retention_days_documents" <= 3650),
	CONSTRAINT "compliance_policies_retention_days_audit_logs_range" CHECK ("retention_days_audit_logs" >= 1 AND "retention_days_audit_logs" <= 3650),
	CONSTRAINT "compliance_policies_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid,
	"correlation_id" uuid NOT NULL,
	"action" text NOT NULL,
	"legal_basis" text NOT NULL,
	"data_category" text NOT NULL,
	"retention_applied_days" integer NOT NULL,
	"status" "compliance_evidence_status" NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_policies" ADD CONSTRAINT "compliance_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_policies" ADD CONSTRAINT "compliance_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;