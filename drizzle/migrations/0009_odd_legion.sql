CREATE TYPE "public"."employee_identity_status" AS ENUM('pending_activation', 'active', 'blocked', 'inactive');--> statement-breakpoint
CREATE TABLE "employee_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"reference_code" text NOT NULL,
	"employee_name" text NOT NULL,
	"admission_date" text NOT NULL,
	"status" "employee_identity_status" DEFAULT 'pending_activation' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_identities_tenant_reference_unique" UNIQUE("tenant_id","reference_code")
);
--> statement-breakpoint
ALTER TABLE "employee_identities" ADD CONSTRAINT "employee_identities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_identities" ADD CONSTRAINT "employee_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;