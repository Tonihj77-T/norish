import type { Slot } from "@/types";

import { eq } from "drizzle-orm";

import { getPendingOrFailedSyncStatuses } from "@/server/db/repositories/caldav-sync-status";
import { syncPlannedItem } from "@/server/caldav/sync-manager";
import { shouldRetry } from "@/server/caldav/retry-handler";
import { db } from "@/server/db/drizzle";
import { plannedRecipes, notes } from "@/server/db/schema";
import { getAllUserIds } from "@/server/db/repositories";
import { schedulerLogger } from "@/server/logger";

/**
 * CalDAV Retry Scheduler
 *
 * Retries failed and pending CalDAV sync operations that are eligible for retry.
 * Runs periodically via cron job.
 */
export async function retryFailedCalDavSyncs(): Promise<{ retried: number; skipped: number }> {
  let retried = 0;
  let skipped = 0;

  try {
    // Get all users with CalDAV enabled
    const allUserIds = await getAllUserIds();

    if (allUserIds.length === 0) {
      schedulerLogger.info("No users found");

      return { retried: 0, skipped: 0 };
    }

    schedulerLogger.info({ userCount: allUserIds.length }, "Checking users for failed syncs");

    for (const userId of allUserIds) {
      try {
        // Get pending/failed items for this user
        const pendingItems = await getPendingOrFailedSyncStatuses(userId);

        if (pendingItems.length === 0) {
          continue;
        }

        schedulerLogger.info({ userId, itemCount: pendingItems.length }, "Items to check for user");

        for (const item of pendingItems) {
          // Check if retry is allowed based on retry count and last sync time
          if (!shouldRetry(item.retryCount, item.lastSyncAt || null)) {
            skipped++;
            continue;
          }

          try {
            // Fetch the planned item to get date, slot, and recipeId
            let date: string | null = null;
            let slot: Slot = "Dinner";
            let recipeId: string | undefined = undefined;

            if (item.itemType === "recipe") {
              const [planned] = await db
                .select()
                .from(plannedRecipes)
                .where(eq(plannedRecipes.id, item.itemId))
                .limit(1);

              if (!planned) {
                schedulerLogger.warn({ itemId: item.itemId }, "Planned recipe not found, skipping");
                skipped++;
                continue;
              }

              date = planned.date;
              slot = planned.slot as Slot;
              recipeId = planned.recipeId;
            } else {
              const [note] = await db
                .select()
                .from(notes)
                .where(eq(notes.id, item.itemId))
                .limit(1);

              if (!note) {
                schedulerLogger.warn({ itemId: item.itemId }, "Note not found, skipping");
                skipped++;
                continue;
              }

              date = note.date;
              slot = note.slot as Slot;
            }

            if (!date) {
              schedulerLogger.warn(
                { itemType: item.itemType, itemId: item.itemId },
                "No date for item, skipping"
              );
              skipped++;
              continue;
            }

            // Attempt to sync the item
            await syncPlannedItem(
              userId,
              item.itemId,
              item.itemType,
              item.plannedItemId,
              item.eventTitle,
              date,
              slot,
              recipeId
            );

            retried++;
            schedulerLogger.info(
              { itemType: item.itemType, itemId: item.itemId, attempt: item.retryCount + 1 },
              "Retried CalDAV sync"
            );
          } catch (err) {
            schedulerLogger.error(
              { err, itemType: item.itemType, itemId: item.itemId },
              "Failed to retry CalDAV sync"
            );
          }
        }
      } catch (err) {
        schedulerLogger.error({ err, userId }, "Error processing user for CalDAV retry");
      }
    }

    schedulerLogger.info({ retried, skipped }, "CalDAV retry complete");
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during CalDAV retry");
  }

  return { retried, skipped };
}
