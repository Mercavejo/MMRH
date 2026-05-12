ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "source_content_base64" text;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "content_base64" text;
