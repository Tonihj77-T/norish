import type { z } from "zod";
import type {
  RecipeIngredientInputSchema,
  RecipeIngredientsWithoutIdSchema,
} from "@/server/db/zodSchemas/recipe-ingredients";

export type RecipeIngredientInsertDto = z.input<typeof RecipeIngredientInputSchema>;
export type RecipeIngredientsDto = z.output<typeof RecipeIngredientsWithoutIdSchema>;
