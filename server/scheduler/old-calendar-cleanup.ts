import { startOfMonth, subMonths, format } from "date-fns";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { deletePlannedRecipesBefore } from "@/server/db/repositories/planned-recipe";
import { deleteNotesBefore } from "@/server/db/repositories/notes";
import { schedulerLogger } from "@/server/logger";

// Cleans up planned recipes and notes older.
export async function cleanupOldCalendarData(): Promise<{
  plannedRecipesDeleted: number;
  notesDeleted: number;
}> {
  try {
    // Calculate cutoff date - first day of (currentMonth - X)
    const retentionMonths = SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS;
    const today = new Date();
    const cutoffDate = startOfMonth(subMonths(today, retentionMonths));
    const cutoffDateString = format(cutoffDate, "yyyy-MM-dd");

    schedulerLogger.info(
      { cutoffDate: cutoffDateString, retentionMonths },
      "Deleting old calendar data"
    );

    // Delete old planned recipes
    const plannedRecipesDeleted = await deletePlannedRecipesBefore(cutoffDateString);

    schedulerLogger.info({ deleted: plannedRecipesDeleted }, "Deleted old planned recipes");

    // Delete old notes
    const notesDeleted = await deleteNotesBefore(cutoffDateString);

    schedulerLogger.info({ deleted: notesDeleted }, "Deleted old notes");

    schedulerLogger.info({ plannedRecipesDeleted, notesDeleted }, "Old calendar cleanup complete");

    return { plannedRecipesDeleted, notesDeleted };
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during calendar cleanup");

    return { plannedRecipesDeleted: 0, notesDeleted: 0 };
  }
}
