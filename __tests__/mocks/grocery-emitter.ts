/**
 * Mock for @/server/trpc/routers/groceries/emitter
 */
import { vi } from "vitest";

export const groceryEmitter = {
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
};

export function resetEmitterMocks() {
  groceryEmitter.emitToHousehold.mockReset();
  groceryEmitter.emitToUser.mockReset();
}
