import type { RecipeSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use global to persist emitter across module reloads
const globalForEmitter = globalThis as unknown as {
  recipeEmitter: TypedEmitter<RecipeSubscriptionEvents> | undefined;
};

export const recipeEmitter =
  globalForEmitter.recipeEmitter ?? createTypedEmitter<RecipeSubscriptionEvents>();

// Always persist to globalThis to ensure singleton across all imports
globalForEmitter.recipeEmitter = recipeEmitter;
