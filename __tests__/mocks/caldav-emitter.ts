import type { CaldavSubscriptionEvents } from "@/server/trpc/routers/caldav/types";

import { vi } from "vitest";

import { TypedEmitter } from "@/server/trpc/emitter";

// Create a mock caldav emitter
export const caldavEmitter = new TypedEmitter<CaldavSubscriptionEvents>();

// Spy on emitter methods for assertions
vi.spyOn(caldavEmitter, "emit");
vi.spyOn(caldavEmitter, "emitToUser");

export default { caldavEmitter };
