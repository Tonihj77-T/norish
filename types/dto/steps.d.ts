import type {
  StepSelectBaseSchema,
  StepInsertBaseSchema,
  StepUpdateBaseSchema,
  StepSelectWithoutId,
} from "@/server/db/zodSchemas/steps";
import type { z } from "zod";

export type StepDto = z.output<typeof StepSelectBaseSchema>;
export type StepInsertDto = z.input<typeof StepInsertBaseSchema>;
export type UpdateStepDto = z.input<typeof StepUpdateBaseSchema>;

export type StepWithoutIdDto = z.infer<typeof StepSelectWithoutId>;
