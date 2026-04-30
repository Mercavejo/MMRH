import { db } from "../src/lib/db/client";
import { tenants } from "../src/lib/db/schema";

async function listTenants() {
  try {
    const allTenants = await db.select().from(tenants).limit(10);
    console.log(JSON.stringify(allTenants, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTenants();
