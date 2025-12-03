import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "@/server/db/index";
import { dbLogger } from "@/server/logger";

export async function runMigrations(): Promise<void> {
  dbLogger.info("Checking and applying DB migrations...");

  try {
    await migrate(db, { migrationsFolder: "./server/db/migrations" });
    dbLogger.info("Migrations complete");
  } catch (err) {
    dbLogger.error({ err }, "Migration failed");
    throw err;
  }
}
