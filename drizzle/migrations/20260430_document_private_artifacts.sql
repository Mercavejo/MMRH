ALTER TABLE "batches"
ADD COLUMN "source_storage_key" text,
ADD COLUMN "source_storage_filename" text,
ADD COLUMN "source_storage_mime_type" text;

ALTER TABLE "employee_documents"
ADD COLUMN "storage_key" text,
ADD COLUMN "file_name" text,
ADD COLUMN "mime_type" text,
ADD COLUMN "source_page_index" integer;
