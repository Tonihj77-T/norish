"use client";

import type { GroceryDto, RecurringGroceryDto } from "@/types";
import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type GroceriesData = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
};

export type GroceriesQueryResult = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setGroceriesData: (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => void;
  invalidate: () => void;
};

export function useGroceriesQuery(): GroceriesQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.groceries.list.queryKey();

  const { data, error, isLoading } = useQuery(trpc.groceries.list.queryOptions());

  const groceries = data?.groceries ?? [];
  const recurringGroceries = data?.recurringGroceries ?? [];

  const setGroceriesData = (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => {
    queryClient.setQueryData<GroceriesData>(queryKey, updater);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    groceries,
    recurringGroceries,
    error,
    isLoading,
    queryKey,
    setGroceriesData,
    invalidate,
  };
}
