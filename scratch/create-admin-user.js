const postgres = require('postgres');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);

  const userData = {
    email: "mercavejo@hotmail.com",
    name: "Victor Januário Gonçalves",
    password: "vitor321",
    tenantName: "FRS Montagens",
    tenantSlug: "frs-montagens",
  };

  try {
    console.log("--- Iniciando criação de usuário administrador (Raw SQL) ---");

    // 1. Garantir Tenant
    let tenant;
    const existingTenants = await sql`
      SELECT id FROM tenants WHERE slug = ${userData.tenantSlug}
    `;

    if (existingTenants.length > 0) {
      tenant = existingTenants[0];
      console.log(`Tenant '${userData.tenantName}' encontrado (ID: ${tenant.id})`);
    } else {
      const [newTenant] = await sql`
        INSERT INTO tenants (name, slug)
        VALUES (${userData.tenantName}, ${userData.tenantSlug})
        RETURNING id
      `;
      tenant = newTenant;
      console.log(`Tenant '${userData.tenantName}' criado (ID: ${tenant.id})`);
    }

    // 2. Gerar Hash de Senha
    const passwordHash = await bcrypt.hash(userData.password, 12);
    console.log("Hash de senha gerado com sucesso.");

    // 3. Criar Usuário
    let user;
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${userData.email}
    `;

    if (existingUsers.length > 0) {
      user = existingUsers[0];
      console.log(`Usuário '${userData.email}' já existe (ID: ${user.id}). Atualizando dados...`);
      await sql`
        UPDATE users 
        SET name = ${userData.name}, password_hash = ${passwordHash}, is_active = true, updated_at = NOW()
        WHERE id = ${user.id}
      `;
    } else {
      const [newUser] = await sql`
        INSERT INTO users (email, name, password_hash)
        VALUES (${userData.email}, ${userData.name}, ${passwordHash})
        RETURNING id
      `;
      user = newUser;
      console.log(`Usuário '${userData.email}' criado (ID: ${user.id})`);
    }

    // 4. Mapeamento de Admin (rh_gestor)
    await sql`
      INSERT INTO user_tenant_mappings (user_id, tenant_id, role)
      VALUES (${user.id}, ${tenant.id}, 'rh_gestor')
      ON CONFLICT (user_id, tenant_id) DO UPDATE 
      SET role = 'rh_gestor'
    `;

    console.log(`Usuário vinculado ao tenant como 'rh_gestor' com sucesso.`);
    console.log("--- Processo concluído com sucesso ---");
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error("ERRO durante o processo:", err);
    await sql.end();
    process.exit(1);
  }
}

main();
