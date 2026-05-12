ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf" text;--> statement-breakpoint
WITH ordered_users AS (
  SELECT "id", lpad(row_number() OVER (ORDER BY "created_at", "id")::text, 11, '0') AS generated_cpf
  FROM "users"
)
UPDATE "users"
SET "cpf" = ordered_users.generated_cpf
FROM ordered_users
WHERE "users"."id" = ordered_users."id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "cpf" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cpf_unique" UNIQUE("cpf");
