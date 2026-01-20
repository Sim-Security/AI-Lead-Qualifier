import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.ts";
import { env } from "@/config/env.ts";

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

// Run migrations on startup
async function runMigrations() {
  try {
    console.log("[DB] Running migrations...");
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("[DB] Migrations completed successfully");
  } catch (error) {
    console.error("[DB] Migration failed:", error);
    // Don't exit - migrations might already be applied
  }
}

// Run migrations immediately
runMigrations();

export { schema };
