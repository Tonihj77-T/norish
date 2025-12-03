import type { CaldavSyncStatusInsertDto, CaldavItemType } from "@/types/dto/caldav-sync-status";
import type { Slot } from "@/types";

import { truncateErrorMessage } from "./retry-handler";

import { CalDavClient, type CreateEventInput } from "@/lib/caldav";
import {
  getCaldavConfigDecrypted,
  getHouseholdCaldavConfigs,
} from "@/server/db/repositories/caldav-config";
import {
  createCaldavSyncStatus,
  updateCaldavSyncStatus,
  getCaldavSyncStatusByItemId,
} from "@/server/db/repositories/caldav-sync-status";
import { getHouseholdMemberIds } from "@/server/db/repositories/households";
import { createLogger } from "@/server/logger";
import { caldavEmitter } from "@/server/trpc/routers/caldav/emitter";

const caldavLogger = createLogger("caldav");

/**
 * Parse time range string (e.g., "08:00-09:00") into start and end times
 */
function parseTimeRange(timeRange: string): { start: string; end: string } {
  const [start, end] = timeRange.split("-");

  return { start: start.trim(), end: end.trim() };
}

/**
 * Get event start and end times based on slot and user preferences
 */
export function getEventTimeRange(
  date: string,
  slot: Slot,
  config: {
    breakfastTime: string;
    lunchTime: string;
    dinnerTime: string;
    snackTime: string;
  }
): { start: Date; end: Date } {
  const slotTimeMap: Record<Slot, string> = {
    Breakfast: config.breakfastTime,
    Lunch: config.lunchTime,
    Dinner: config.dinnerTime,
    Snack: config.snackTime,
  };

  const timeRange = slotTimeMap[slot];
  const { start: startTime, end: endTime } = parseTimeRange(timeRange);

  // Parse date (YYYY-MM-DD format)
  const [year, month, day] = date.split("-").map(Number);

  // Parse start time (HH:MM format)
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, startHour, startMinute));

  // Parse end time (HH:MM format)
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day, endHour, endMinute));

  return { start, end };
}

/**
 * Sync a planned item to CalDAV server
 */
export async function syncPlannedItem(
  userId: string,
  itemId: string,
  itemType: CaldavItemType,
  plannedItemId: string | null,
  eventTitle: string,
  date: string,
  slot: Slot,
  recipeId?: string
): Promise<void> {
  // Get user's CalDAV config
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    throw new Error("CalDAV not configured or disabled");
  }

  // Get or create sync status
  let syncStatus = await getCaldavSyncStatusByItemId(userId, itemId);
  const isNew = !syncStatus;

  try {
    // If updating and title changed, delete old event first
    if (syncStatus && syncStatus.caldavEventUid && syncStatus.eventTitle !== eventTitle) {
      await deletePlannedItem(userId, itemId);
      syncStatus = null; // Treat as new
    }

    // Create CalDAV client
    const client = new CalDavClient({
      baseUrl: config.serverUrl,
      username: config.username,
      password: config.password,
    });

    // Build event times
    const { start, end } = getEventTimeRange(date, slot, config);

    // Build deep link URL for recipes
    const url = recipeId
      ? `${process.env.AUTH_URL || "http://localhost:3000"}/recipes/${recipeId}`
      : undefined;

    // Create event input
    const eventInput: CreateEventInput = {
      summary: eventTitle,
      start,
      end,
      description: url,
      url,
    };

    // Create event on CalDAV server
    const created = await client.createEvent(eventInput);

    // Save or update sync status
    if (isNew) {
      const insertData: CaldavSyncStatusInsertDto = {
        userId,
        itemId,
        itemType,
        plannedItemId,
        eventTitle,
        syncStatus: "synced",
        caldavEventUid: created.uid,
        retryCount: 0,
        errorMessage: null,
        lastSyncAt: new Date(),
      };

      await createCaldavSyncStatus(insertData);
    } else {
      await updateCaldavSyncStatus(syncStatus!.id, {
        eventTitle,
        syncStatus: "synced",
        caldavEventUid: created.uid,
        retryCount: 0,
        errorMessage: null,
        lastSyncAt: new Date(),
      });
    }

    // Emit sync completed event for UI updates
    caldavEmitter.emitToUser(userId, "itemStatusUpdated", {
      itemId,
      itemType,
      syncStatus: "synced",
      errorMessage: null,
      caldavEventUid: created.uid,
    });
    caldavEmitter.emitToUser(userId, "syncCompleted", {
      itemId,
      caldavEventUid: created.uid,
    });
  } catch (error) {
    const errorMessage = truncateErrorMessage(
      error instanceof Error ? error.message : String(error)
    );
    const retryCount = syncStatus?.retryCount ?? 0;

    if (isNew) {
      const insertData: CaldavSyncStatusInsertDto = {
        userId,
        itemId,
        itemType,
        plannedItemId,
        eventTitle,
        syncStatus: "failed",
        caldavEventUid: null,
        retryCount: 0,
        errorMessage,
        lastSyncAt: new Date(),
      };

      await createCaldavSyncStatus(insertData);
    } else {
      await updateCaldavSyncStatus(syncStatus!.id, {
        eventTitle,
        syncStatus: "failed",
        retryCount: retryCount + 1,
        errorMessage,
        lastSyncAt: new Date(),
      });
    }

    // Emit sync failed event for UI updates
    caldavEmitter.emitToUser(userId, "itemStatusUpdated", {
      itemId,
      itemType,
      syncStatus: "failed",
      errorMessage,
      caldavEventUid: null,
    });

    caldavEmitter.emitToUser(userId, "syncFailed", {
      itemId,
      errorMessage,
      retryCount: retryCount + 1,
    });

    throw error;
  }
}

/**
 * Delete a planned item from CalDAV server
 */
export async function deletePlannedItem(userId: string, itemId: string): Promise<void> {
  const syncStatus = await getCaldavSyncStatusByItemId(userId, itemId);

  if (!syncStatus || !syncStatus.caldavEventUid) {
    // Nothing to delete on CalDAV server, just mark as removed
    if (syncStatus) {
      await updateCaldavSyncStatus(syncStatus.id, {
        syncStatus: "removed",
        lastSyncAt: new Date(),
      });
    }

    return;
  }

  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    // Config disabled, just mark as removed
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      lastSyncAt: new Date(),
    });

    return;
  }

  try {
    // Delete from CalDAV server
    const href = config.serverUrl + syncStatus.caldavEventUid + ".ics";
    const auth = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");

    const response = await fetch(href, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`CalDAV delete failed ${response.status} ${response.statusText}`);
    }

    // Mark as removed
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      lastSyncAt: new Date(),
      errorMessage: null,
    });
  } catch (error) {
    const errorMessage = truncateErrorMessage(
      error instanceof Error ? error.message : String(error)
    );

    // Still mark as removed but log the error
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      errorMessage,
      lastSyncAt: new Date(),
    });
  }
}

/**
 * Sync item to all unique household CalDAV servers
 */
export async function syncToHouseholdServers(
  userId: string,
  itemId: string,
  itemType: CaldavItemType,
  plannedItemId: string | null,
  eventTitle: string,
  date: string,
  slot: Slot,
  recipeId?: string
): Promise<void> {
  // Get all household member IDs
  const householdUserIds = await getHouseholdMemberIds(userId);

  // Get unique CalDAV configs
  const configMap = await getHouseholdCaldavConfigs(householdUserIds);

  // Sync to each unique server
  const syncPromises: Promise<void>[] = [];

  for (const [serverUrl, config] of configMap.entries()) {
    const promise = syncPlannedItem(
      config.userId,
      itemId,
      itemType,
      plannedItemId,
      eventTitle,
      date,
      slot,
      recipeId
    ).catch((error) => {
      caldavLogger.error(
        { err: error, serverUrl, userId: config.userId },
        "Failed to sync to CalDAV server"
      );
    });

    syncPromises.push(promise);
  }

  await Promise.allSettled(syncPromises);
}
