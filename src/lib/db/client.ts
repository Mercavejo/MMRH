import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
const maxPoolSize = Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10);
let clientDb: ReturnType<typeof drizzle> | null = null;

function getDbClient(): ReturnType<typeof drizzle> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Drizzle client.");
  }

  if (!clientDb) {
    const client = postgres(connectionString, {
      max: Number.isNaN(maxPoolSize) || maxPoolSize < 1 ? 10 : maxPoolSize,
    });

    clientDb = drizzle(client, { schema });
  }

  return clientDb;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const client = getDbClient();
    const value = Reflect.get(client as unknown as object, property);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
}) as ReturnType<typeof drizzle>;
