ALTER TYPE "public"."batch_source_format" ADD VALUE IF NOT EXISTS 'pdf';--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;