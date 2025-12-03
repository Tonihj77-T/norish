/**
 * CalDAV Calendar Sync Service
 *
 * Listens to global calendar events from the tRPC calendarEmitter and triggers
 * CalDAV sync operations. This replaces the old event bus listener pattern.
 *
 * Events handled:
 * - globalRecipePlanned => Create CalDAV event for planned recipe
 * - globalRecipeDeleted => Delete CalDAV event
 * - globalRecipeUpdated => Update CalDAV event (date change)
 * - globalNotePlanned => Create CalDAV event for note
 * - globalNoteDeleted => Delete CalDAV event
 * - globalNoteUpdated => Update CalDAV event (date change)
 */

import type { CalendarSubscriptionEvents } from "@/server/trpc/routers/calendar/types";
import type { Slot } from "@/types";

import { syncPlannedItem, deletePlannedItem } from "./sync-manager";

import { calendarEmitter } from "@/server/trpc/routers/calendar/emitter";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import {
  getCaldavSyncStatusByItemId,
  getPendingOrFailedSyncStatuses,
} from "@/server/db/repositories/caldav-sync-status";
import {
  getPlannedRecipeViewById,
  getPlannedRecipesByRecipeId,
  getFuturePlannedRecipes,
} from "@/server/db/repositories/planned-recipe";
import { getNoteViewById, getFutureNotes } from "@/server/db/repositories/notes";
import { getRecipeFull } from "@/server/db/repositories/recipes";
import { createLogger } from "@/server/logger";

const log = createLogger("caldav-sync");

let isInitialized = false;

/**
 * Initialize the CalDAV sync service.
 * Registers listeners on the calendarEmitter for global events.
 * Should be called once on server startup.
 */
export function initCaldavSync(): void {
  if (isInitialized) {
    log.warn("CalDAV sync service already initialized");

    return;
  }

  log.info("Initializing CalDAV sync service");

  // ========== Recipe Planned → Create CalDAV Event ==========
  calendarEmitter.on(
    calendarEmitter.globalEvent("globalRecipePlanned"),
    async (data: CalendarSubscriptionEvents["globalRecipePlanned"]) => {
      const { id, recipeId, recipeName, date, slot, userId } = data;

      log.debug({ id, recipeId, userId }, "Recipe planned - syncing to CalDAV");

      try {
        await syncPlannedItem(userId, id, "recipe", id, recipeName, date, slot, recipeId);
        log.info({ id, userId }, "CalDAV sync completed for planned recipe");
      } catch (error) {
        log.error({ err: error, id, userId }, "CalDAV sync failed for planned recipe");
      }
    }
  );

  calendarEmitter.on(
    calendarEmitter.globalEvent("globalRecipeDeleted"),
    async (data: CalendarSubscriptionEvents["globalRecipeDeleted"]) => {
      const { id, userId } = data;

      log.debug({ id, userId }, "Recipe unplanned - removing from CalDAV");

      try {
        await deletePlannedItem(userId, id);
        log.info({ id, userId }, "CalDAV delete completed for unplanned recipe");
      } catch (error) {
        log.error({ err: error, id, userId }, "CalDAV delete failed for unplanned recipe");
      }
    }
  );

  calendarEmitter.on(
    calendarEmitter.globalEvent("globalRecipeUpdated"),
    async (data: CalendarSubscriptionEvents["globalRecipeUpdated"]) => {
      const { id, recipeId, recipeName, newDate, slot, userId } = data;

      log.debug({ id, userId, newDate }, "Recipe date updated - updating CalDAV");

      try {
        // Check if this recipe is synced
        const syncStatus = await getCaldavSyncStatusByItemId(userId, id);

        if (!syncStatus) {
          log.debug({ id, userId }, "Recipe not synced to CalDAV, skipping update");

          return;
        }

        // Re-sync to update date/time
        await syncPlannedItem(userId, id, "recipe", id, recipeName, newDate, slot, recipeId);
        log.info({ id, userId, newDate }, "CalDAV sync completed for recipe date update");
      } catch (error) {
        log.error({ err: error, id, userId }, "CalDAV sync failed for recipe date update");
      }
    }
  );

  calendarEmitter.on(
    calendarEmitter.globalEvent("globalNotePlanned"),
    async (data: CalendarSubscriptionEvents["globalNotePlanned"]) => {
      const { id, title, date, slot, userId } = data;

      log.debug({ id, title, userId }, "Note planned - syncing to CalDAV");

      try {
        await syncPlannedItem(userId, id, "note", id, title, date, slot);
        log.info({ id, userId }, "CalDAV sync completed for planned note");
      } catch (error) {
        log.error({ err: error, id, userId }, "CalDAV sync failed for planned note");
      }
    }
  );

  calendarEmitter.on(
    calendarEmitter.globalEvent("globalNoteDeleted"),
    async (data: CalendarSubscriptionEvents["globalNoteDeleted"]) => {
      const { id, userId } = data;

      log.debug({ id, userId }, "Note unplanned - removing from CalDAV");

      try {
        await deletePlannedItem(userId, id);
        log.info({ id, userId }, "CalDAV delete completed for unplanned note");
      } catch (error) {
        log.error({ err: error, id, userId }, "CalDAV delete failed for unplanned note");
      }
    }
  );

  calendarEmitter.on(
    calendarEmitter.globalEvent("globalNoteUpdated"),
    async (data: CalendarSubscriptionEvents["globalNoteUpdated"]) => {
      const { id, title, newDate, slot, userId } = data;

      log.debug({ id, userId, newDate }, "Note date updated - updating CalDAV");

      try {
        // Check if this note is synced
        const syncStatus = await getCaldavSyncStatusByItemId(userId, id);

        if (!syncStatus) {
          log.debug({ id, userId }, "Note not synced to CalDAV, skipping update");

          return;
        }

        // Re-sync with new date
        await syncPlannedItem(userId, id, "note", id, title, newDate, slot);
        log.info({ id, userId, newDate }, "CalDAV sync completed for note date update");
      } catch (error) {
        log.error({ err: error, id, userId }, "CalDAV sync failed for note date update");
      }
    }
  );

  recipeEmitter.on(recipeEmitter.broadcastEvent("updated"), async (data) => {
    const { recipe } = data;

    if (!recipe || !recipe.name) return;

    const recipeId = recipe.id;
    const newName = recipe.name;

    log.debug({ recipeId, newName }, "Recipe name updated - updating CalDAV events");

    try {
      // Find all planned instances of this recipe
      const plannedInstances = await getPlannedRecipesByRecipeId(recipeId);

      // Update CalDAV event for each planned instance
      for (const planned of plannedInstances) {
        await syncPlannedItem(
          planned.userId,
          planned.id,
          "recipe",
          planned.id,
          newName,
          planned.date,
          planned.slot as Slot,
          recipeId
        );
      }

      log.info(
        { recipeId, count: plannedInstances.length },
        "CalDAV sync completed for recipe name update"
      );
    } catch (error) {
      log.error({ err: error, recipeId }, "CalDAV sync failed for recipe name update");
    }
  });

  isInitialized = true;
  log.info("CalDAV sync service initialized");
}

export async function syncAllFutureItems(userId: string): Promise<{
  totalSynced: number;
  totalFailed: number;
}> {
  log.info({ userId }, "Starting initial CalDAV sync for all future items");

  const today = new Date().toISOString().split("T")[0];
  let totalSynced = 0;
  let totalFailed = 0;

  try {
    // Get all future planned recipes for this user
    const futurePlannedRecipes = await getFuturePlannedRecipes(today);
    const userRecipes = futurePlannedRecipes.filter((p) => p.userId === userId);

    // Get all future notes for this user
    const futureNotes = await getFutureNotes(today);
    const userNotes = futureNotes.filter((n) => n.userId === userId);

    log.debug(
      { userId, recipeCount: userRecipes.length, noteCount: userNotes.length },
      "Found future items to sync"
    );

    // Sync all future planned recipes
    for (const planned of userRecipes) {
      try {
        const recipe = await getRecipeFull(planned.recipeId);

        if (!recipe) continue;

        await syncPlannedItem(
          planned.userId,
          planned.id,
          "recipe",
          planned.id,
          recipe.name,
          planned.date,
          planned.slot as Slot,
          planned.recipeId
        );
        totalSynced++;
      } catch (error) {
        log.error(
          { err: error, plannedId: planned.id, userId },
          "Failed to sync planned recipe during initial sync"
        );
        totalFailed++;
      }
    }

    // Sync all future notes
    for (const note of userNotes) {
      try {
        await syncPlannedItem(
          note.userId,
          note.id,
          "note",
          note.id,
          note.title,
          note.date,
          note.slot as Slot
        );
        totalSynced++;
      } catch (error) {
        log.error(
          { err: error, noteId: note.id, userId },
          "Failed to sync note during initial sync"
        );
        totalFailed++;
      }
    }

    log.info({ userId, totalSynced, totalFailed }, "Initial CalDAV sync completed");

    return { totalSynced, totalFailed };
  } catch (error) {
    log.error({ err: error, userId }, "Initial CalDAV sync failed");
    throw error;
  }
}

export async function retryFailedSyncs(userId: string): Promise<{
  totalRetried: number;
  totalFailed: number;
}> {
  log.info({ userId }, "Starting retry of pending/failed CalDAV syncs");

  let totalRetried = 0;
  let totalFailed = 0;

  try {
    // Get all pending/failed sync statuses for this user
    const pendingItems = await getPendingOrFailedSyncStatuses(userId);

    log.debug({ userId, count: pendingItems.length }, "Found pending/failed items to retry");

    // Retry each pending/failed item
    for (const item of pendingItems) {
      try {
        if (item.itemType === "recipe") {
          const planned = await getPlannedRecipeViewById(item.itemId);

          if (!planned) continue;

          const recipe = await getRecipeFull(planned.recipeId);

          if (!recipe) continue;

          await syncPlannedItem(
            userId,
            item.itemId,
            "recipe",
            item.plannedItemId || planned.id,
            recipe.name,
            planned.date,
            planned.slot as Slot,
            planned.recipeId
          );
        } else {
          // Note
          const note = await getNoteViewById(item.itemId);

          if (!note) continue;

          await syncPlannedItem(
            userId,
            item.itemId,
            "note",
            item.plannedItemId || note.id,
            note.title,
            note.date,
            note.slot as Slot
          );
        }

        totalRetried++;
      } catch (error) {
        log.error({ err: error, itemId: item.itemId, userId }, "Failed to retry sync item");
        totalFailed++;
      }
    }

    log.info({ userId, totalRetried, totalFailed }, "CalDAV sync retry completed");

    return { totalRetried, totalFailed };
  } catch (error) {
    log.error({ err: error, userId }, "CalDAV sync retry failed");
    throw error;
  }
}
