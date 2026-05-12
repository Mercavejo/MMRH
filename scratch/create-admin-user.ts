import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import { tenants } from "../src/lib/db/schema/tenants";
import { users } from "../src/lib/db/schema/users";
import { userTenantMappings } from "../src/lib/db/schema/user-tenant-mappings";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  const userData = {
    cpf: "44444444444",
    email: "mercavejo@hotmail.com",
    name: "Victor Januário Gonçalves",
    password: "vitor321",
    tenantName: "FRS Montagens",
    tenantSlug: "frs-montagens",
  };

  try {
    console.log("--- Iniciando criação de usuário administrador ---");

    // 1. Garantir Tenant
    let tenantId: string;
    const existingTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, userData.tenantSlug));

    if (existingTenants.length > 0) {
      tenantId = existingTenants[0].id;
      console.log(`Tenant '${userData.tenantName}' encontrado (ID: ${tenantId})`);
    } else {
      const [newTenant] = await db
        .insert(tenants)
        .values({
          name: userData.tenantName,
          slug: userData.tenantSlug,
        })
        .returning({ id: tenants.id });
      tenantId = newTenant.id;
      console.log(`Tenant '${userData.tenantName}' criado (ID: ${tenantId})`);
    }

    // 2. Gerar Hash de Senha
    const passwordHash = await bcrypt.hash(userData.password, 12);
    console.log("Hash de senha gerado com sucesso.");

    // 3. Criar Usuário
    let userId: string;
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.cpf, userData.cpf));

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
      console.log(`Usuário '${userData.email}' já existe (ID: ${userId}). Atualizando dados...`);
      await db
        .update(users)
        .set({
          name: userData.name,
          passwordHash,
          isActive: true,
        })
        .where(eq(users.id, userId));
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          cpf: userData.cpf,
          email: userData.email,
          name: userData.name,
          passwordHash,
        })
        .returning({ id: users.id });
      userId = newUser.id;
      console.log(`Usuário '${userData.cpf}' criado (ID: ${userId})`);
    }

    // 4. Mapeamento de Admin (rh_gestor)
    await db
      .insert(userTenantMappings)
      .values({
        userId,
        tenantId,
        role: "rh_gestor",
      })
      .onConflictDoUpdate({
        target: [userTenantMappings.userId, userTenantMappings.tenantId],
        set: { role: "rh_gestor" },
      });

    console.log(`Usuário vinculado ao tenant como 'rh_gestor' com sucesso.`);
    console.log("--- Processo concluído com sucesso ---");
    process.exit(0);
  } catch (err) {
    console.error("ERRO durante o processo:", err);
    process.exit(1);
  }
}

main();
