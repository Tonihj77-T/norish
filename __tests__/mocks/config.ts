/**
 * Mock for @/config/server-config-loader
 */
import { vi } from "vitest";

export const getUnits = vi.fn().mockResolvedValue({});
export const getRecurrenceConfig = vi.fn().mockResolvedValue({});

export function resetConfigMocks() {
  getUnits.mockReset().mockResolvedValue({});
  getRecurrenceConfig.mockReset().mockResolvedValue({});
}
