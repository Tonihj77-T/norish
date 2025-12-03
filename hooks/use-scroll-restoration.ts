import { useCallback } from "react";

// Store scroll state outside component lifecycle
// Stores both scrollTop (for window scroll) and firstItemIndex (for Virtuoso)
interface ScrollState {
  scrollTop: number;
  firstItemIndex: number;
}

const scrollStateStore = new Map<string, ScrollState>();

export function useScrollRestoration<T extends Record<string, any>>(filters: T) {
  const getFilterHash = useCallback(() => {
    const entries = Object.entries(filters)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:${value.sort().join(",")}`;
        }

        return `${key}:${value}`;
      });

    return entries.join("|");
  }, [filters]);

  const saveScrollState = useCallback(
    (scrollTop: number, firstItemIndex: number = 0) => {
      const hash = getFilterHash();

      scrollStateStore.set(hash, { scrollTop, firstItemIndex });
    },
    [getFilterHash]
  );

  const getScrollState = useCallback((): ScrollState | undefined => {
    const hash = getFilterHash();

    return scrollStateStore.get(hash);
  }, [getFilterHash]);

  return {
    saveScrollState,
    getScrollState,
  };
}
