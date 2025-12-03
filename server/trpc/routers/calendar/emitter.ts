import type { CalendarSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use global to persist emitter across module reloads
const globalForEmitter = globalThis as unknown as {
  calendarEmitter: TypedEmitter<CalendarSubscriptionEvents> | undefined;
};

export const calendarEmitter =
  globalForEmitter.calendarEmitter ?? createTypedEmitter<CalendarSubscriptionEvents>();

// Always persist to globalThis to ensure singleton across all imports
globalForEmitter.calendarEmitter = calendarEmitter;
