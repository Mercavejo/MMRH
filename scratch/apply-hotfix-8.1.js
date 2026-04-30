const postgres = require('postgres');
const connectionString = 'postgresql://postgres.axnbcicqpfcztvyibypk:danzone1980%21@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const sql = postgres(connectionString);

async function applyHotfix() {
  try {
    console.log('Applying manual schema hotfix for Story 8.1...');

    await sql.begin(async (sql) => {
      // 1. Create Enum
      await sql`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_publication_status') THEN
                CREATE TYPE "public"."batch_publication_status" AS ENUM('pending', 'publishing', 'published', 'failed');
            END IF;
        END
        $$;
      `;
      console.log('✓ Enum batch_publication_status verified/created');

      // 2. Add Columns
      await sql`
        ALTER TABLE "batches" 
        ADD COLUMN IF NOT EXISTS "publication_status" "public"."batch_publication_status" DEFAULT 'pending' NOT NULL,
        ADD COLUMN IF NOT EXISTS "publication_attempts" integer DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "published_by" uuid,
        ADD COLUMN IF NOT EXISTS "last_publication_correlation_id" uuid,
        ADD COLUMN IF NOT EXISTS "last_publication_idempotency_key" text,
        ADD COLUMN IF NOT EXISTS "last_publication_error" text;
      `;
      console.log('✓ Columns added to batches table');

      // 3. Add FK
      await sql`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'batches_published_by_users_id_fk') THEN
                ALTER TABLE "batches" ADD CONSTRAINT "batches_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
            END IF;
        END
        $$;
      `;
      console.log('✓ Foreign key batches_published_by_users_id_fk verified/created');
    });

    console.log('\nHotfix applied successfully!');

  } catch (error) {
    console.error('Error applying hotfix:', error);
  } finally {
    await sql.end();
  }
}

applyHotfix();
