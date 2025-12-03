import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockPlannedRecipe,
  createMockNote,
} from "./test-utils";

// Track subscription callbacks
let subscriptionCallbacks: Record<string, (data: any) => void> = {};
const mockSetCalendarData = vi.fn();
const mockRemoveRecipeFromCache = vi.fn();
const mockRemoveNoteFromCache = vi.fn();
const mockInvalidate = vi.fn();

// Mock useSubscription to capture callbacks
vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn((_options) => {
    // The subscriptionOptions should return something we can identify
    // We'll track the callback via the hook call order
  }),
}));

// Mock addToast
vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

// Mock the tRPC provider with subscription tracking
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listRecipes: {
        queryKey: () => ["calendar", "listRecipes"],
        queryOptions: () => ({
          queryKey: ["calendar", "listRecipes"],
          queryFn: async () => [],
        }),
      },
      listNotes: {
        queryKey: () => ["calendar", "listNotes"],
        queryOptions: () => ({
          queryKey: ["calendar", "listNotes"],
          queryFn: async () => [],
        }),
      },
      onRecipePlanned: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onRecipePlanned"] = options?.onData;

          return { enabled: true };
        },
      },
      onRecipeDeleted: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onRecipeDeleted"] = options?.onData;

          return { enabled: true };
        },
      },
      onRecipeUpdated: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onRecipeUpdated"] = options?.onData;

          return { enabled: true };
        },
      },
      onNotePlanned: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onNotePlanned"] = options?.onData;

          return { enabled: true };
        },
      },
      onNoteDeleted: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onNoteDeleted"] = options?.onData;

          return { enabled: true };
        },
      },
      onNoteUpdated: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onNoteUpdated"] = options?.onData;

          return { enabled: true };
        },
      },
      onFailed: {
        subscriptionOptions: (input: any, options: any) => {
          subscriptionCallbacks["onFailed"] = options?.onData;

          return { enabled: true };
        },
      },
    },
  }),
}));

// Mock the query hook
vi.mock("@/hooks/calendar/use-calendar-query", () => ({
  useCalendarQuery: () => ({
    calendarData: {},
    setCalendarData: mockSetCalendarData,
    removeRecipeFromCache: mockRemoveRecipeFromCache,
    removeNoteFromCache: mockRemoveNoteFromCache,
    invalidate: mockInvalidate,
  }),
}));

// Import after mocking
// eslint-disable-next-line import/order
import { addToast } from "@heroui/react";

import { useCalendarSubscription } from "@/hooks/calendar/use-calendar-subscription";

describe("useCalendarSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionCallbacks = {};
    queryClient = createTestQueryClient();
  });

  // Helper to render the hook and capture subscription callbacks
  function renderSubscriptionHook() {
    const { renderHook } = require("@testing-library/react");
    const { result } = renderHook(() => useCalendarSubscription("2025-01-01", "2025-01-31"), {
      wrapper: createTestWrapper(queryClient),
    });

    return result;
  }

  describe("onRecipePlanned subscription", () => {
    it("adds new recipe to calendar data", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onRecipePlanned"];

      expect(callback).toBeDefined();

      const newRecipe = createMockPlannedRecipe({
        id: "pr-new",
        date: "2025-01-15",
        recipeName: "New Recipe",
      });

      callback({ plannedRecipe: newRecipe });

      expect(mockSetCalendarData).toHaveBeenCalled();
    });
  });

  describe("onRecipeDeleted subscription", () => {
    it("removes recipe from calendar data", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onRecipeDeleted"];

      expect(callback).toBeDefined();

      callback({ plannedRecipeId: "pr-123", date: "2025-01-15" });

      expect(mockSetCalendarData).toHaveBeenCalled();
    });
  });

  describe("onRecipeUpdated subscription", () => {
    it("updates recipe in calendar data (moves between dates)", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onRecipeUpdated"];

      expect(callback).toBeDefined();

      const updatedRecipe = createMockPlannedRecipe({
        id: "pr-123",
        date: "2025-01-20",
      });

      callback({ plannedRecipe: updatedRecipe, oldDate: "2025-01-15" });

      expect(mockSetCalendarData).toHaveBeenCalled();
    });
  });

  describe("onNotePlanned subscription", () => {
    it("adds new note to calendar data", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onNotePlanned"];

      expect(callback).toBeDefined();

      const newNote = createMockNote({
        id: "note-new",
        date: "2025-01-15",
        title: "New Note",
      });

      callback({ note: newNote });

      expect(mockSetCalendarData).toHaveBeenCalled();
    });
  });

  describe("onNoteDeleted subscription", () => {
    it("removes note from calendar data", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onNoteDeleted"];

      expect(callback).toBeDefined();

      callback({ noteId: "note-123", date: "2025-01-15" });

      expect(mockSetCalendarData).toHaveBeenCalled();
    });
  });

  describe("onNoteUpdated subscription", () => {
    it("updates note in calendar data (moves between dates)", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onNoteUpdated"];

      expect(callback).toBeDefined();

      const updatedNote = createMockNote({
        id: "note-123",
        date: "2025-01-20",
      });

      callback({ note: updatedNote, oldDate: "2025-01-15" });

      expect(mockSetCalendarData).toHaveBeenCalled();
    });
  });

  describe("onFailed subscription", () => {
    it("shows toast and invalidates on failure", () => {
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onFailed"];

      expect(callback).toBeDefined();

      callback({ reason: "Something went wrong" });

      expect(addToast).toHaveBeenCalledWith({
        severity: "danger",
        title: "Something went wrong",
      });
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });
});
