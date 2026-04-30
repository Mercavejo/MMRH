const postgres = require('postgres');
const bcrypt = require('bcryptjs');

async function main() {
  const sql = postgres('postgresql://postgres.axnbcicqpfcztvyibypk:danzone1980%21@aws-1-sa-east-1.pooler.supabase.com:5432/postgres', {
    ssl: 'require',
    max: 1
  });

  const userData = {
    email: "mercavejo@hotmail.com",
    name: "Victor Januário Gonçalves",
    password: "vitor321",
    tenantName: "FRS Montagens",
    tenantSlug: "frs-montagens",
  };

  try {
    console.log("--- Iniciando criação de usuário (SSL Require) ---");
    let [tenant] = await sql`SELECT id FROM tenants WHERE slug = ${userData.tenantSlug}`;
    if (!tenant) {
      [tenant] = await sql`INSERT INTO tenants (name, slug) VALUES (${userData.tenantName}, ${userData.tenantSlug}) RETURNING id`;
    }
    const passwordHash = await bcrypt.hash(userData.password, 12);
    let [user] = await sql`SELECT id FROM users WHERE email = ${userData.email}`;
    if (user) {
      await sql`UPDATE users SET name = ${userData.name}, password_hash = ${passwordHash}, is_active = true WHERE id = ${user.id}`;
    } else {
      [user] = await sql`INSERT INTO users (email, name, password_hash) VALUES (${userData.email}, ${userData.name}, ${passwordHash}) RETURNING id`;
    }
    await sql`
      INSERT INTO user_tenant_mappings (user_id, tenant_id, role)
      VALUES (${user.id}, ${tenant.id}, 'rh_gestor')
      ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'rh_gestor'
    `;
    console.log("Sucesso!");
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error("Falha:", err);
    if (sql) await sql.end();
    process.exit(1);
  }
}

main();
