import type { GrocerySubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use global to persist emitter across module reloads
const globalForEmitter = globalThis as unknown as {
  groceryEmitter: TypedEmitter<GrocerySubscriptionEvents> | undefined;
};

export const groceryEmitter =
  globalForEmitter.groceryEmitter ?? createTypedEmitter<GrocerySubscriptionEvents>();

// Always persist to globalThis to ensure singleton across all imports
globalForEmitter.groceryEmitter = groceryEmitter;
