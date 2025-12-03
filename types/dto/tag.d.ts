import type { z } from "zod";
import type { TagSelectBaseSchema } from "@/server/db/zodSchemas/tag";

export type TagDto = z.output<typeof TagSelectBaseSchema>;
