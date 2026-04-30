import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { tenants, users, userTenantMappings } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;

async function run() {
  if (!connectionString) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  const data = {
    email: "mercavejo@hotmail.com",
    name: "Victor Januário Gonçalves",
    password: "vitor321",
    tenantName: "FRS Montagens",
    tenantSlug: "frs-montagens",
  };

  try {
    console.log("Checking tenant...");
    let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, data.tenantSlug)).limit(1);

    if (!tenant) {
      console.log("Creating tenant...");
      [tenant] = await db.insert(tenants).values({
        name: data.tenantName,
        slug: data.tenantSlug,
      }).returning();
    }
    console.log("Tenant ID:", tenant.id);

    console.log("Hashing password...");
    const passwordHash = await bcrypt.hash(data.password, 12);

    console.log("Upserting user...");
    let [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (user) {
      console.log("Updating existing user...");
      await db.update(users).set({
        name: data.name,
        passwordHash,
        isActive: true,
      }).where(eq(users.id, user.id));
    } else {
      console.log("Inserting new user...");
      [user] = await db.insert(users).values({
        email: data.email,
        name: data.name,
        passwordHash,
      }).returning();
    }
    console.log("User ID:", user.id);

    console.log("Ensuring mapping...");
    await db.insert(userTenantMappings).values({
      userId: user.id,
      tenantId: tenant.id,
      role: "rh_gestor",
    }).onConflictDoUpdate({
      target: [userTenantMappings.userId, userTenantMappings.tenantId],
      set: { role: "rh_gestor" },
    });

    console.log("Creation successful!");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
}

run();
