ALTER TABLE "tenant_capability_usage" DROP CONSTRAINT "tenant_capability_usage_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant_capability_usage" ADD CONSTRAINT "tenant_capability_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_capability_usage" ADD CONSTRAINT "usage_count_non_negative" CHECK ("tenant_capability_usage"."usage_count" >= 0);--> statement-breakpoint
ALTER TABLE "tenant_capability_usage" ADD CONSTRAINT "period_format_check" CHECK ("tenant_capability_usage"."period" ~ '^d{4}-d{2}$');