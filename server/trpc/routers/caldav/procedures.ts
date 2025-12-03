/**
 * CalDAV tRPC Procedures
 *
 * Handles CalDAV configuration management, connection testing, and sync operations.
 */

import type { UserCaldavConfigWithoutPasswordDto } from "@/types";

import { TRPCError } from "@trpc/server";

import { caldavEmitter } from "./emitter";
import {
  SaveCaldavConfigInputSchema,
  TestCaldavConnectionInputSchema,
  DeleteCaldavConfigInputSchema,
  GetSyncStatusInputSchema,
} from "./types";

import { router } from "@/server/trpc/trpc";
import { authedProcedure } from "@/server/trpc/middleware";
import { createLogger } from "@/server/logger";
import { syncAllFutureItems, retryFailedSyncs } from "@/server/caldav/calendar-sync";
import {
  getCaldavConfigWithoutPassword,
  getCaldavConfigDecrypted,
  saveCaldavConfig,
  deleteCaldavConfig,
} from "@/server/db/repositories/caldav-config";
import {
  getCaldavSyncStatusesByUser,
  getSyncStatusSummary,
} from "@/server/db/repositories/caldav-sync-status";

const log = createLogger("caldav-procedures");

export const caldavRouter = router({
  /**
   * Get CalDAV configuration for the current user (without password).
   */
  getConfig: authedProcedure.query(
    async ({ ctx }): Promise<UserCaldavConfigWithoutPasswordDto | null> => {
      const userId = ctx.user.id;

      const config = await getCaldavConfigWithoutPassword(userId);

      if (!config) {
        return null;
      }

      return config;
    }
  ),

  /**
   * Get the decrypted password for config editing.
   */
  getPassword: authedProcedure.query(async ({ ctx }): Promise<string | null> => {
    const userId = ctx.user.id;

    const config = await getCaldavConfigDecrypted(userId);

    return config?.password || null;
  }),

  /**
   * Save CalDAV configuration (create or update).
   */
  saveConfig: authedProcedure
    .input(SaveCaldavConfigInputSchema)
    .mutation(async ({ ctx, input }): Promise<UserCaldavConfigWithoutPasswordDto> => {
      const userId = ctx.user.id;

      log.info({ userId }, "Saving CalDAV configuration");

      // First test the connection before saving
      try {
        const authHeader =
          "Basic " + Buffer.from(`${input.username}:${input.password}`).toString("base64");

        const response = await fetch(input.serverUrl, {
          method: "PROPFIND",
          headers: {
            Authorization: authHeader,
            Depth: "0",
          },
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Connection failed: ${response.status} ${response.statusText}`,
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Connection test failed",
        });
      }

      // Save the config
      const _saved = await saveCaldavConfig(userId, {
        serverUrl: input.serverUrl,
        username: input.username,
        password: input.password,
        enabled: input.enabled,
        breakfastTime: input.breakfastTime,
        lunchTime: input.lunchTime,
        dinnerTime: input.dinnerTime,
        snackTime: input.snackTime,
      });

      // Get the saved config without password for response
      const configWithoutPassword = await getCaldavConfigWithoutPassword(userId);

      if (!configWithoutPassword) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve saved configuration",
        });
      }

      // Emit config saved event
      caldavEmitter.emitToUser(userId, "configSaved", { config: configWithoutPassword });

      // If enabled, trigger initial sync of all future items
      if (input.enabled) {
        log.info({ userId }, "CalDAV enabled - starting initial sync");

        // Run sync in background, don't wait
        syncAllFutureItems(userId)
          .then((result) => {
            log.info({ userId, ...result }, "Initial CalDAV sync completed");
            caldavEmitter.emitToUser(userId, "initialSyncComplete", {
              timestamp: new Date().toISOString(),
              totalSynced: result.totalSynced,
              totalFailed: result.totalFailed,
            });
          })
          .catch((err) => {
            log.error({ err, userId }, "Initial CalDAV sync failed");
          });
      }

      return configWithoutPassword;
    }),

  /**
   * Test CalDAV connection without saving.
   */
  testConnection: authedProcedure
    .input(TestCaldavConnectionInputSchema)
    .mutation(async ({ input }): Promise<{ success: boolean; message: string }> => {
      try {
        const authHeader =
          "Basic " + Buffer.from(`${input.username}:${input.password}`).toString("base64");

        const response = await fetch(input.serverUrl, {
          method: "PROPFIND",
          headers: {
            Authorization: authHeader,
            Depth: "0",
          },
        });

        if (!response.ok) {
          return {
            success: false,
            message: `Connection failed: ${response.status} ${response.statusText}`,
          };
        }

        return {
          success: true,
          message: "Connection successful",
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Connection test failed",
        };
      }
    }),

  /**
   * Check connection status using stored credentials.
   */
  checkConnection: authedProcedure.query(
    async ({ ctx }): Promise<{ success: boolean; message: string }> => {
      const userId = ctx.user.id;

      try {
        const config = await getCaldavConfigDecrypted(userId);

        if (!config) {
          return {
            success: false,
            message: "No configuration found",
          };
        }

        const authHeader =
          "Basic " + Buffer.from(`${config.username}:${config.password}`).toString("base64");

        const response = await fetch(config.serverUrl, {
          method: "PROPFIND",
          headers: {
            Authorization: authHeader,
            Depth: "0",
          },
        });

        if (!response.ok) {
          return {
            success: false,
            message: `Connection failed: ${response.status} ${response.statusText}`,
          };
        }

        return {
          success: true,
          message: "Connected",
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Connection failed",
        };
      }
    }
  ),

  /**
   * Delete CalDAV configuration.
   */
  deleteConfig: authedProcedure
    .input(DeleteCaldavConfigInputSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const userId = ctx.user.id;

      log.info({ userId, deleteEvents: input.deleteEvents }, "Deleting CalDAV configuration");

      // TODO: If deleteEvents is true, delete all CalDAV events from the server
      // This would require iterating through sync statuses and deleting each event

      await deleteCaldavConfig(userId);

      // Emit config deleted event
      caldavEmitter.emitToUser(userId, "configSaved", { config: null });

      return { success: true };
    }),

  /**
   * Get sync status list with pagination.
   */
  getSyncStatus: authedProcedure.input(GetSyncStatusInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.user.id;

    const filters = input.statusFilter
      ? [input.statusFilter as "pending" | "synced" | "failed"]
      : undefined;

    const result = await getCaldavSyncStatusesByUser(userId, filters, input.page, input.pageSize);

    return {
      statuses: result.items,
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }),

  /**
   * Get sync status summary counts.
   */
  getSummary: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    return getSyncStatusSummary(userId);
  }),

  /**
   * Manually trigger sync for pending/failed items.
   */
  triggerSync: authedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;

    log.info({ userId }, "Manually triggering CalDAV sync");

    // Emit sync started event
    caldavEmitter.emitToUser(userId, "syncStarted", {
      timestamp: new Date().toISOString(),
    });

    // Run retry in background
    retryFailedSyncs(userId)
      .then((result) => {
        log.info({ userId, ...result }, "Manual CalDAV sync completed");
        caldavEmitter.emitToUser(userId, "initialSyncComplete", {
          timestamp: new Date().toISOString(),
          totalSynced: result.totalRetried,
          totalFailed: result.totalFailed,
        });
      })
      .catch((err) => {
        log.error({ err, userId }, "Manual CalDAV sync failed");
      });

    return { started: true };
  }),

  /**
   * Sync all future items (for initial setup or re-sync).
   */
  syncAll: authedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;

    log.info({ userId }, "Starting full CalDAV sync");

    // Emit sync started event
    caldavEmitter.emitToUser(userId, "syncStarted", {
      timestamp: new Date().toISOString(),
    });

    // Run sync in background
    syncAllFutureItems(userId)
      .then((result) => {
        log.info({ userId, ...result }, "Full CalDAV sync completed");
        caldavEmitter.emitToUser(userId, "initialSyncComplete", {
          timestamp: new Date().toISOString(),
          totalSynced: result.totalSynced,
          totalFailed: result.totalFailed,
        });
      })
      .catch((err) => {
        log.error({ err, userId }, "Full CalDAV sync failed");
      });

    return { started: true };
  }),
});

export type CaldavRouter = typeof caldavRouter;
