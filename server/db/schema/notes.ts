import { index, pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";
import { users } from "./auth";
import { slotTypeEnum } from "./planned-recipe";

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    slot: slotTypeEnum("slot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_notes_user_date").on(t.userId, t.date), index("idx_notes_user").on(t.userId)]
);
