import type { HouseholdSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use global to persist emitter across module reloads
const globalForEmitter = globalThis as unknown as {
  householdEmitter: TypedEmitter<HouseholdSubscriptionEvents> | undefined;
};

export const householdEmitter =
  globalForEmitter.householdEmitter ?? createTypedEmitter<HouseholdSubscriptionEvents>();

// Always persist to globalThis to ensure singleton across all imports
globalForEmitter.householdEmitter = householdEmitter;
