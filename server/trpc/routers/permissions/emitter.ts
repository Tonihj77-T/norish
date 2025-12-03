import type { PermissionsSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use global to persist emitter across module reloads
const globalForEmitter = globalThis as unknown as {
  permissionsEmitter: TypedEmitter<PermissionsSubscriptionEvents> | undefined;
};

export const permissionsEmitter =
  globalForEmitter.permissionsEmitter ?? createTypedEmitter<PermissionsSubscriptionEvents>();

// Always persist to globalThis to ensure singleton across all imports
globalForEmitter.permissionsEmitter = permissionsEmitter;
