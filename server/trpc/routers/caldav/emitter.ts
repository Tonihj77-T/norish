import type { CaldavSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use global to persist emitter across module reloads
const globalForEmitter = globalThis as unknown as {
  caldavEmitter: TypedEmitter<CaldavSubscriptionEvents> | undefined;
};

export const caldavEmitter =
  globalForEmitter.caldavEmitter ?? createTypedEmitter<CaldavSubscriptionEvents>();

// Always persist to globalThis to ensure singleton across all imports
globalForEmitter.caldavEmitter = caldavEmitter;
