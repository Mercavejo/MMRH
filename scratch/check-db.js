const postgres = require('postgres');
const connectionString = 'postgresql://postgres.axnbcicqpfcztvyibypk:danzone1980%21@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const sql = postgres(connectionString);

async function checkDetails() {
  try {
    console.log('--- BATCHES COLUMNS ---');
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'batches'`;
    cols.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));

    console.log('\n--- AUDIT_LOGS COLUMNS ---');
    const auditCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs'`;
    auditCols.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkDetails();
