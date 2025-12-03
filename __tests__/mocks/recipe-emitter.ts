/**
 * Mock for @/server/trpc/routers/recipes/emitter
 */
import { vi } from "vitest";

export const recipeEmitter = {
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
  householdEvent: vi.fn(
    (householdKey: string, event: string) => `household:${householdKey}:${event}`
  ),
  userEvent: vi.fn((userId: string, event: string) => `user:${userId}:${event}`),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

export function resetRecipeEmitterMock() {
  recipeEmitter.emitToHousehold.mockReset();
  recipeEmitter.emitToUser.mockReset();
  recipeEmitter.householdEvent.mockClear();
  recipeEmitter.userEvent.mockClear();
  recipeEmitter.on.mockReset();
  recipeEmitter.off.mockReset();
  recipeEmitter.emit.mockReset();
}
