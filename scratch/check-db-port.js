const postgres = require('postgres');
// Trying port 6543 (Transaction Mode)
const connectionString = 'postgresql://postgres.axnbcicqpfcztvyibypk:danzone1980%21@aws-1-sa-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function checkDetails() {
  try {
    console.log('Connecting via port 6543...');
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('--- TABLES ---');
    tables.forEach(t => console.log(t.table_name));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkDetails();
