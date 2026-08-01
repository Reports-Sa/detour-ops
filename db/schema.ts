import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projectWorkspaces = sqliteTable(
  "project_workspaces",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    projectCode: text("project_code").notNull(),
    projectTitle: text("project_title").notNull(),
    stateJson: text("state_json").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("workspace_owner_project_idx").on(
      table.ownerId,
      table.projectCode,
    ),
  ],
);

export const activityEvents = sqliteTable("activity_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
