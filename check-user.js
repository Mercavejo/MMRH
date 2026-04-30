const postgres = require('postgres');

async function check() {
  const sql = postgres('postgresql://postgres.axnbcicqpfcztvyibypk:danzone1980!@aws-1-sa-east-1.pooler.supabase.com:5432/postgres', { 
    ssl: 'require', 
    prepare: false 
  });
  
  try {
    const user = await sql`SELECT id, email, is_active, password_hash FROM users WHERE email = 'mercavejo@hotmail.com'`;
    console.log("User:", JSON.stringify(user, null, 2));
    
    if (user.length > 0) {
      const mapping = await sql`SELECT * FROM user_tenant_mappings WHERE user_id = ${user[0].id}`;
      console.log("Mapping:", JSON.stringify(mapping, null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
