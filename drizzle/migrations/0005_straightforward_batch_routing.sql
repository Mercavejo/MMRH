CREATE TYPE "public"."batch_routing_status" AS ENUM('pending', 'processing', 'blocked', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_status" "public"."batch_routing_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_total_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_matched_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_pending_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_failed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_ambiguous_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_blocked_reason" text;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "routing_processed_at" timestamp with time zone;--> statement-breakpoint