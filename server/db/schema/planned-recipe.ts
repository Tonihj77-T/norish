import { index, pgTable, text, timestamp, uuid, date, pgEnum } from "drizzle-orm/pg-core";

import { users } from "./auth";

import { recipes } from "./index";

export const slotTypeEnum = pgEnum("slot_type", ["Breakfast", "Lunch", "Dinner", "Snack"]);

export const plannedRecipes = pgTable(
  "planned_recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slot: slotTypeEnum("slot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_planned_recipes_user_date").on(t.userId, t.date),
    index("idx_planned_recipes_user").on(t.userId),
    index("idx_planned_recipes_recipe").on(t.recipeId),
  ]
);
