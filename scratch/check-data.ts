import 'dotenv/config';
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { tenants } from "../src/lib/db/schema/tenants";

const connectionString = process.env.DATABASE_URL;

async function check() {
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    const allTenants = await db.select().from(tenants);
    console.log("Current Tenants:");
    console.log(JSON.stringify(allTenants, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
