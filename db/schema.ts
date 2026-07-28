import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Durable application snapshot for the simulation milestone.
 *
 * All browser state crosses a versioned REST boundary before being stored here.
 * Keeping the payload behind that boundary lets the production phase replace
 * this table with normalized PostgreSQL repositories without touching the UI.
 */
export const appState = sqliteTable("app_state", {
  id: text("id").primaryKey(),
  schemaVersion: integer("schema_version").notNull().default(1),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
});
