"use client";

import type { ServerConfigKey } from "@/server/db/zodSchemas/server-config";

import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type AdminConfigsData = Record<ServerConfigKey, unknown>;

/**
 * Query hook for all server configs.
 * Returns configs with sensitive fields masked.
 */
export function useAdminConfigsQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.admin.getAllConfigs.queryKey();

  const { data, error, isLoading } = useQuery(trpc.admin.getAllConfigs.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    configs: (data ?? {}) as AdminConfigsData,
    error,
    isLoading,
    queryKey,
    invalidate,
  };
}

/**
 * Query hook for user's admin role.
 * Used to determine if admin tab should show.
 */
export function useUserRoleQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery(trpc.admin.getUserRole.queryOptions());

  return {
    isOwner: data?.isOwner ?? false,
    isAdmin: data?.isAdmin ?? false,
    isServerAdmin: (data?.isOwner || data?.isAdmin) ?? false,
    error,
    isLoading,
  };
}
