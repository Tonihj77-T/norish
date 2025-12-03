/**
 * Mock for @/server/trpc/routers/calendar/emitter
 */
import { vi } from "vitest";

export const calendarEmitter = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

export function resetCalendarEmitterMocks() {
  calendarEmitter.emit.mockReset();
  calendarEmitter.on.mockReset();
  calendarEmitter.off.mockReset();
}
