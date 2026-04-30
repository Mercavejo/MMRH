ALTER TABLE "employee_documents" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "source_page_index" integer;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "content_base64" text;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "source_storage_key" text;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "source_storage_filename" text;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "source_storage_mime_type" text;