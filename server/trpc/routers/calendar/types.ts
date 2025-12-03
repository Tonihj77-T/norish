import type { PlannedRecipeViewDto, NoteViewDto, Slot } from "@/types";

/**
 * Calendar subscription event payloads.
 */
export type CalendarSubscriptionEvents = {
  recipePlanned: { plannedRecipe: PlannedRecipeViewDto };
  recipeDeleted: { plannedRecipeId: string; date: string };
  recipeUpdated: { plannedRecipe: PlannedRecipeViewDto; oldDate: string };
  notePlanned: { note: NoteViewDto };
  noteDeleted: { noteId: string; date: string };
  noteUpdated: { note: NoteViewDto; oldDate: string };
  failed: { reason: string };

  // Global events for server-side listeners (e.g., CalDAV sync)
  // These include userId since the listener needs to know which user to sync
  globalRecipePlanned: {
    id: string;
    recipeId: string;
    recipeName: string;
    date: string;
    slot: Slot;
    userId: string;
  };
  globalRecipeDeleted: { id: string; userId: string };
  globalRecipeUpdated: {
    id: string;
    recipeId: string;
    recipeName: string;
    newDate: string;
    slot: Slot;
    userId: string;
  };
  globalNotePlanned: {
    id: string;
    title: string;
    date: string;
    slot: Slot;
    userId: string;
  };
  globalNoteDeleted: { id: string; userId: string };
  globalNoteUpdated: {
    id: string;
    title: string;
    newDate: string;
    slot: Slot;
    userId: string;
  };
};
