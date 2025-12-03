/**
 * Mock for permissions emitter
 */
import { vi } from "vitest";

export const permissionsEmitter = {
  broadcast: vi.fn(),
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
  broadcastEvent: vi.fn().mockReturnValue("broadcast:policyUpdated"),
  householdEvent: vi.fn(),
  userEvent: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};
