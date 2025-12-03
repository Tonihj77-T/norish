import type { z } from "zod";

import { UserDtoSchema } from "@/server/db";

export type User = z.output<typeof UserDtoSchema>;
