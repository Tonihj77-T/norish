import type { IngredientSelectBaseSchema } from "@/server/db/zodSchemas/ingredient";
import type { z } from "zod";

export type IngredientDto = z.output<typeof IngredientSelectBaseSchema>;
