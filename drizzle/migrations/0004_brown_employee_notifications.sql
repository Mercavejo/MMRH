CREATE TYPE "public"."notification_channel" AS ENUM('in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_context_type" AS ENUM('document', 'contestation');--> statement-breakpoint
CREATE TABLE "employee_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"event_type" text NOT NULL,
	"context_type" "notification_context_type" NOT NULL,
	"context_id" text NOT NULL,
	"status_from" text NOT NULL,
	"status_to" text NOT NULL,
	"recommended_action" text NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_notifications_dedupe_unique" UNIQUE("user_id","context_type","context_id","event_type","status_to")
);
--> statement-breakpoint
ALTER TABLE "employee_notifications" ADD CONSTRAINT "employee_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notifications" ADD CONSTRAINT "employee_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
