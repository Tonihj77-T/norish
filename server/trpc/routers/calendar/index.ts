import { router } from "../../trpc";

import { plannedRecipesProcedures } from "./planned-recipes";
import { notesProcedures } from "./notes";
import { calendarSubscriptions } from "./subscriptions";

export { calendarEmitter } from "./emitter";
export type { CalendarSubscriptionEvents } from "./types";

export const calendarRouter = router({
  ...plannedRecipesProcedures._def.procedures,
  ...notesProcedures._def.procedures,
  ...calendarSubscriptions._def.procedures,
});
