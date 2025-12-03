# tRPC Migration Plan

This document tracks the migration from Server Actions + SWR + Legacy WebSockets to tRPC with TanStack Query.

**Status: ✅ MIGRATION COMPLETE** (254 tests passing)

---

## Architecture Overview

### Data Flow Pattern

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React UI      │────▶│  tRPC Mutation   │────▶│   Database      │
│  (fire & forget)│     │  (returns ID)    │     │   (async)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        │                        │
┌─────────────────┐              │               ┌──────────────────┐
│  Optimistic UI  │◀─────────────┘               │  EventEmitter    │
│  (onSuccess)    │                              │  (global singleton)
└─────────────────┘                              └──────────────────┘
        │                                                 │
        │                                                 ▼
        │                                        ┌──────────────────┐
        └───────────────────────────────────────▶│  tRPC Subscription│
                    reconcile                    │  (WebSocket)     │
                                                 └──────────────────┘
```

**Flow:**

1. UI calls mutation (fire-and-forget, no await)
2. tRPC returns ID immediately → `onSuccess` updates cache optimistically
3. Database write happens async
4. EventEmitter broadcasts to all household members
5. WebSocket subscription receives event → reconciles/confirms cache

### Key Patterns

#### 1. Fire-and-Forget Mutations (NO await)

Mutations return immediately with an ID. We update the UI optimistically in `onSuccess` as soon as we get the ID, then WebSocket subscriptions reconcile/confirm the data.

```typescript
// Example from use-groceries-mutations.ts

const createGrocery = (raw: string) => {
  const parsed = parseIngredientWithDefaults(raw, units)[0];
  const groceryData = {
    name: parsed.description,
    amount: parsed.quantity,
    unit: parsed.unitOfMeasure,
    isDone: false,
  };

  // Fire and forget - no await!
  createMutation.mutate([groceryData], {
    onSuccess: (ids) => {
      // Optimistically add to cache immediately using returned ID
      const id = ids[0];
      const dto: GroceryDto = { id, ...groceryData, recurringGroceryId: null };

      setGroceriesData((prev) => {
        if (!prev) return prev;
        const exists = prev.groceries.some((g) => g.id === id);
        if (exists) return prev;
        return { ...prev, groceries: [dto, ...prev.groceries] };
      });
    },
    onError: () => invalidate(), // Rollback by refetching
  });
};

// For toggle/update operations, optimistic update happens BEFORE the mutation
const toggleGroceries = (ids: string[], isDone: boolean) => {
  // Optimistic update first
  setGroceriesData((prev) => {
    if (!prev) return prev;
    const updated = prev.groceries.map((g) => (ids.includes(g.id) ? { ...g, isDone } : g));
    return { ...prev, groceries: updated };
  });

  // Then fire mutation
  toggleMutation.mutate(
    { groceryIds: ids, isDone },
    {
      onError: () => invalidate(), // Rollback on error
    }
  );
};
```

**Key points:**

- `mutate()` not `mutateAsync()` - never await
- `onSuccess` receives the ID from backend → update cache optimistically
- `onError` calls `invalidate()` to rollback by refetching
- For updates/toggles: optimistic update happens BEFORE mutation call

#### 2. Global Singleton Emitters (HMR-Safe)

Emitters must be global singletons to survive Hot Module Replacement in development:

```typescript
// server/trpc/routers/groceries/types.ts
import type { GroceryDto, RecurringGroceryDto } from "@/types";

export type GrocerySubscriptionEvents = {
  created: { groceries: GroceryDto[] };
  updated: { changedGroceries: GroceryDto[] };
  deleted: { groceryIds: string[] };
  recurringCreated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringUpdated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringDeleted: { recurringGroceryId: string };
  failed: { reason: string };
};

// server/trpc/routers/groceries/emitter.ts
import type { GrocerySubscriptionEvents } from "./types";
import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist emitter across HMR in development
const globalForEmitter = globalThis as unknown as {
  groceryEmitter: TypedEmitter<GrocerySubscriptionEvents> | undefined;
};

export const groceryEmitter =
  globalForEmitter.groceryEmitter ?? createTypedEmitter<GrocerySubscriptionEvents>();

// Only store in globalThis during development (HMR)
if (process.env.NODE_ENV !== "production") {
  globalForEmitter.groceryEmitter = groceryEmitter;
}
```

**Why this matters:** Without the global singleton, HMR creates a new emitter instance. The subscription listens on the old instance, but mutations emit on the new instance → events never received.

#### 3. Query Hook with Cache Setters

```typescript
// hooks/groceries/use-groceries-query.ts
"use client";

import type { GroceryDto, RecurringGroceryDto } from "@/types";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/providers/trpc-provider";

export type GroceriesData = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
};

export function useGroceriesQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get the query key from tRPC (auto-generated, type-safe)
  const queryKey = trpc.groceries.list.queryKey();

  // Execute the query
  const { data, error, isLoading } = useQuery(trpc.groceries.list.queryOptions());

  // Provide cache setter for optimistic updates
  const setGroceriesData = (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => {
    queryClient.setQueryData<GroceriesData>(queryKey, updater);
  };

  // Invalidate to refetch (used on error rollback)
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    groceries: data?.groceries ?? [],
    recurringGroceries: data?.recurringGroceries ?? [],
    error,
    isLoading,
    queryKey,
    setGroceriesData,
    invalidate,
  };
}
```

**Key points:**

- `setGroceriesData` allows mutations and subscriptions to update the cache
- `invalidate` triggers a refetch (used for error rollback)
- Query key comes from tRPC for type safety

#### 4. Subscription Pattern with Node.js Events

```typescript
// SERVER: server/trpc/routers/groceries/subscriptions.ts
import { on } from "events";

const onCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Household-scoped event name
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "created");

  log.debug({ userId: ctx.user.id, householdKey: ctx.householdKey }, "Subscribed");

  try {
    // Node.js events.on() returns async iterator
    for await (const [data] of on(groceryEmitter, eventName, { signal })) {
      yield data as GrocerySubscriptionEvents["created"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed");
  }
});

// CLIENT: hooks/groceries/use-groceries-subscription.ts
export function useGroceriesSubscription() {
  const trpc = useTRPC();
  const { setGroceriesData, invalidate } = useGroceriesQuery();

  // Subscribe to created events
  useSubscription(
    trpc.groceries.onCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;

          const existing = prev.groceries ?? [];
          const incoming = payload.groceries;
          // Only add groceries that don't already exist (dedup with optimistic)
          const newGroceries = incoming.filter((g) => !existing.some((eg) => eg.id === g.id));

          if (newGroceries.length === 0) return prev;

          return { ...prev, groceries: [...newGroceries, ...existing] };
        });
      },
    })
  );

  // Subscribe to deleted events
  useSubscription(
    trpc.groceries.onDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;
          const filtered = prev.groceries.filter((g) => !payload.groceryIds.includes(g.id));
          return { ...prev, groceries: filtered };
        });
      },
    })
  );

  // Subscribe to failed events (show toast, invalidate cache)
  useSubscription(
    trpc.groceries.onFailed.subscriptionOptions(undefined, {
      onData: (payload) => {
        addToast({ title: "Error", description: payload.reason, color: "danger" });
        invalidate();
      },
    })
  );
}
```

**Key points:**

- Server uses `events.on()` with AbortSignal for cleanup
- Client uses `useSubscription` from `@trpc/tanstack-react-query`
- Always deduplicate incoming data with existing cache (optimistic updates may already be there)
- `onFailed` subscription handles server-side errors gracefully

#### 5. Context Types (void returns for fire-and-forget)

```typescript
// app/(app)/groceries/context.tsx
import type { GroceryDto, RecurringGroceryDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

// ✅ CORRECT - All actions return void (fire-and-forget)
type DataCtx = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  isLoading: boolean;

  // All actions are void - they don't block
  createGrocery: (raw: string) => void;
  createRecurringGrocery: (raw: string, pattern: RecurrencePattern) => void;
  toggleGroceries: (ids: string[], isDone: boolean) => void;
  updateGrocery: (id: string, raw: string) => void;
  deleteGroceries: (ids: string[]) => void;
  getRecurringGroceryForGrocery: (groceryId: string) => RecurringGroceryDto | null;
};

// ❌ WRONG - Promise returns force consumers to await
type DataCtx = {
  createGrocery: (raw: string) => Promise<string>; // DON'T DO THIS
  deleteGroceries: (ids: string[]) => Promise<void>; // DON'T DO THIS
};
```

**Why void returns:**

- Consumers don't need to `await` - UI stays responsive
- Optimistic updates happen immediately in `onSuccess`
- Errors are handled via `onError` callback + toast
- WebSocket subscriptions handle cross-device sync

---

## Completed Migrations

### ✅ Phase 1: Groceries

**Backend:**

- `server/trpc/routers/groceries/groceries.ts` - CRUD procedures
- `server/trpc/routers/groceries/recurring.ts` - Recurring grocery procedures
- `server/trpc/routers/groceries/subscriptions.ts` - WebSocket subscriptions
- `server/trpc/routers/groceries/emitter.ts` - Global singleton emitter

**Frontend:**

- `hooks/groceries/use-groceries-query.ts` - TanStack Query hook
- `hooks/groceries/use-groceries-mutations.ts` - Fire-and-forget mutations
- `hooks/groceries/use-groceries-subscription.ts` - Real-time updates
- `app/(app)/groceries/context.tsx` - Context with void return types

**Tests:** 23 tests passing

### ✅ Phase 2: Calendar

**Backend:**

- `server/trpc/routers/calendar/planned-recipes.ts` - Recipe planning procedures
- `server/trpc/routers/calendar/notes.ts` - Calendar notes procedures
- `server/trpc/routers/calendar/subscriptions.ts` - 7 subscription endpoints
- `server/trpc/routers/calendar/emitter.ts` - Global singleton emitter
- `server/trpc/routers/calendar/types.ts` - Zod schemas & event types

**Frontend:**

- `hooks/calendar/use-calendar-query.ts` - Combined query with optimistic merging
- `hooks/calendar/use-calendar-mutations.ts` - Fire-and-forget mutations
- `hooks/calendar/use-calendar-subscription.ts` - All 7 subscriptions
- `app/(app)/calendar/context.tsx` - Context with void return types

**Features:**

- Recipe planning from mini-recipes updates in real-time
- Date range queries with automatic cache invalidation
- Optimistic updates merge correctly with server data

### ✅ Phase 3: Recipes

**Backend:**

- `server/trpc/routers/recipes/recipes.ts` - CRUD + import + convert procedures
  - `list` - Infinite query with filters (search, tags, filterMode, sortMode)
  - `get` - Single recipe with permission checks
  - `create` - Manual recipe creation with refs
  - `update` - Update recipe with refs
  - `delete` - Delete with permission checks
  - `importFromUrl` - AI-powered URL import (async processing)
  - `convertMeasurements` - AI-powered unit conversion
- `server/trpc/routers/recipes/subscriptions.ts` - WebSocket subscriptions
  - `onImportStarted`, `onImported`, `onCreated`, `onUpdated`, `onDeleted`, `onConverted`, `onFailed`
- `server/trpc/routers/recipes/emitter.ts` - Global singleton emitter
- `server/trpc/routers/recipes/import.ts` - Shared import logic (used by both tRPC and REST API)
- `server/trpc/routers/recipes/types.ts` - RecipeSubscriptionEvents type
- `server/db/zodSchemas/recipe.ts` - All input schemas moved here

**Frontend:**

- `hooks/recipes/use-recipes-query.ts` - Infinite query with filter support
  - Shared pending recipes state via query cache
  - `setAllRecipesData` for updating all filter variants
- `hooks/recipes/use-recipe-query.ts` - Single recipe query
- `hooks/recipes/use-recipes-mutations.ts` - Fire-and-forget mutations
- `hooks/recipes/use-recipes-subscription.tsx` - All 7 subscriptions
- `hooks/recipes/use-recipe-subscription.tsx` - Single recipe subscription (for detail page)
- `context/recipes-context.tsx` - Context with void return types
- `components/Panel/consumers/mini-recipes.tsx` - Uses `useRecipesQuery` hook
- `components/dashboard/recipe-grid.tsx` - Simplified scroll restoration

**Cleanup Done:**

- ❌ Deleted `actions/recipes.ts` - All recipe actions replaced by tRPC
- ❌ Deleted `app/api/recipes/dashboard/` - Replaced by `trpc.recipes.list`
- ❌ Deleted `app/api/recipes/[id]/` - Replaced by `trpc.recipes.get`
- ❌ Deleted `app/api/recipes/count/` - Unused
- ❌ Deleted `app/api/calendar/planned/` - Replaced by `trpc.calendar.listRecipes/listNotes`
- ❌ Deleted `app/api/permissions/` - Replaced by `trpc.permissions.get`
- ❌ Deleted `hooks/data/use-recipes.tsx` - Old SWR hook
- ❌ Deleted `hooks/data/use-all-recipes.tsx` - Old SWR hook
- ❌ Deleted `hooks/data/use-recipe.tsx` - Old SWR hook (replaced by `hooks/recipes/use-recipe-query.ts`)
- ❌ Deleted `hooks/data/use-grocery.tsx` - Old SWR hook (replaced by tRPC groceries hooks)

**Kept (still needed):**

- ✅ `app/api/import/recipe/` - REST endpoint for iOS Shortcuts (uses shared import logic)

### ✅ Phase 7: User Settings

**Backend:**

- `server/trpc/routers/user/user.ts` - User profile procedures
  - `get` - Fetch user profile + API keys
  - `updateName` - Update display name
  - `uploadAvatar` - FormData upload for avatar image
  - `deleteAvatar` - Remove avatar
  - `deleteAccount` - Delete user account
- `server/trpc/routers/user/api-keys.ts` - API key management
  - `create` - Create new API key
  - `delete` - Delete API key
  - `toggle` - Enable/disable API key
- `server/trpc/routers/user/types.ts` - Zod schemas and types
- `server/trpc/routers/user/index.ts` - User router combining procedures

**Frontend:**

- `hooks/user/use-user-query.ts` - Query hook with cache setters
- `hooks/user/use-user-mutations.ts` - All mutation hooks (name, avatar, API keys, delete account)
- `hooks/user/index.ts` - Barrel exports
- `app/(app)/settings/user/context.tsx` - Context updated to use tRPC hooks

**Key Implementation Details:**

- **FormData Support**: Avatar upload uses tRPC with FormData input via `splitLink` in tRPC client
- **splitLink Configuration**: Routes FormData mutations through `httpLink`, JSON through `httpBatchLink` with superjson
- **Shared Image Types**: `types/uploads.ts` exports `ALLOWED_IMAGE_MIME_SET`, `IMAGE_MIME_TO_EXTENSION`, `MAX_AVATAR_SIZE`, `MAX_RECIPE_IMAGE_SIZE`

**Deleted Files:**

- ❌ `actions/user.ts` - Replaced by tRPC procedures
- ❌ `app/api/user/settings/` - Replaced by `trpc.user.get`
- ❌ `hooks/use-user-settings.ts` - Replaced by `hooks/user/`
- ❌ `app/api/recipes/images/` - Replaced by `trpc.recipes.uploadImage/deleteImage`

**Tests:** 19 tests for user functionality

- `__tests__/hooks/user/use-user-query.test.ts` - 6 tests
- `__tests__/hooks/user/use-user-mutations.test.ts` - 3 tests
- `__tests__/trpc/user/user.test.ts` - 10 tests

### ✅ Phase 8: Recipe Image Upload & Mela Import

**Backend:**

- `server/trpc/routers/recipes/images.ts` - Recipe image procedures
  - `uploadImage` - FormData upload for recipe images
  - `deleteImage` - Remove recipe image by URL
- `server/trpc/routers/recipes/mela.ts` - Mela archive import
  - `importMela` - FormData upload, returns immediately with importId
  - Async processing with progress events every 10 recipes
  - Duplicate detection by URL (preferred) or exact title match
- `server/trpc/routers/recipes/subscriptions.ts` - Added Mela subscriptions
  - `onMelaProgress` - Progress updates with batch of imported recipes
  - `onMelaCompleted` - Final import status with skipped count
- `server/trpc/routers/recipes/types.ts` - Added Mela event types (uses shared types from `types/uploads.ts`)
- `server/db/repositories/recipes.ts` - Added `findExistingRecipe` for duplicate detection

**Frontend:**

- `hooks/recipes/use-mela-import.ts` - Persistent Mela import state
  - State stored in TanStack Query cache (survives navigation)
  - Subscribes to `onMelaProgress` and `onMelaCompleted`
  - Shows toast with imported/skipped/error counts
- `hooks/recipes/use-recipes-subscription.tsx` - Added Mela subscriptions
  - `onMelaProgress` - Adds recipes to list incrementally
  - `onMelaCompleted` - Invalidates to ensure final state
- `components/navbar/mela-importer.tsx` - Updated to use `useMelaImport` hook

**Shared Types (`types/uploads.ts`):**

- `ALLOWED_IMAGE_MIME_TYPES` / `ALLOWED_IMAGE_MIME_SET` - Allowed upload types
- `IMAGE_MIME_TO_EXTENSION` - MIME to file extension mapping
- `MAX_AVATAR_SIZE` / `MAX_RECIPE_IMAGE_SIZE` - Size limits
- `MelaImportError`, `MelaProgressPayload`, `MelaCompletedPayload` - Mela event types

**Key Implementation Details:**

- **Streaming Progress**: Import runs async, emits progress every 10 recipes via WebSocket
- **Duplicate Detection**: Checks by URL first (most reliable), falls back to case-insensitive title match
- **Skipped Count**: Completion event includes `skipped` count, shown in toast
- **Proxy Bypass**: `/api/trpc` routes excluded from proxy.ts to prevent body stream lock on large uploads
- **Body Size Limit**: `next.config.js` has `proxyClientMaxBodySize: '500mb'` for large Mela archives

**Tests:** 12 tests for Mela import

- `__tests__/trpc/recipes/mela.test.ts` - 12 tests (validation, progress, completion, duplicate detection)

### ✅ Phase 4: Permissions

**Backend:**

- `server/trpc/routers/permissions/permissions.ts` - Permission policy query
- `server/trpc/routers/permissions/subscriptions.ts` - Policy update subscription (uses `broadcastEvent` for global broadcasts)
- `server/trpc/routers/permissions/emitter.ts` - Global singleton emitter
- `server/trpc/routers/permissions/types.ts` - PermissionsSubscriptionEvents type

**Frontend:**

- `hooks/data/use-permissions.ts` - Query + subscription
  - Subscribes to `onPolicyUpdated` and invalidates ALL queries when policy changes
  - Policy updates include AI enabled state changes (affects recipe convert button)

**Integration:**

- When admin updates permission policy via `trpc.admin.updateRecipePermissionPolicy`, emits directly to `permissionsEmitter.broadcast("policyUpdated")`
- When admin updates AI config and enabled state changes, also emits to `permissionsEmitter.broadcast("policyUpdated")`
- All tRPC subscriptions receive the update and invalidate their queries

### ✅ Phase 6: Households

**Backend:**

- `server/trpc/routers/households/households.ts` - Household management procedures
  - `get` - Fetch current household settings (or null if not in household)
  - `create` - Create new household, user becomes admin
  - `join` - Join household via invite code
  - `leave` - Leave current household
  - `kick` - Remove member (admin only)
  - `regenerateCode` - Generate new invite code (admin only)
  - `transferAdmin` - Transfer admin role to another member
- `server/trpc/routers/households/subscriptions.ts` - WebSocket subscriptions
  - `onCreated`, `onJoined`, `onLeft`, `onKicked`, `onCodeRegenerated`, `onAdminTransferred`, `onMemberAdded`, `onFailed`
- `server/trpc/routers/households/emitter.ts` - Global singleton emitter (HMR-safe)
- `server/trpc/routers/households/types.ts` - HouseholdSubscriptionEvents type & Zod schemas
- `server/trpc/routers/index.ts` - Registered households router

**Frontend:**

- `hooks/households/use-household-query.ts` - Query hook with cache setters
- `hooks/households/use-household-mutations.ts` - Fire-and-forget mutations for all operations
- `hooks/households/use-household-subscription.ts` - All 8 subscription handlers
- `hooks/households/index.ts` - Barrel exports
- `app/(app)/settings/household/context.tsx` - Context updated to use tRPC hooks

**Key Implementation Details:**

- **Better Auth User IDs**: Better Auth uses non-UUID IDs (e.g., "QPpJ0snL4ow9BnCRuZxHElzW0cvDKmLg"). Added `UserIdSchema` (simple string validation) in `lib/validation/schemas.ts` for userId fields in kick/transferAdmin mutations.
- **Permission Emission for Kicked Users**: When a user is kicked, `permissionsEmitter.emitToUser()` is called to trigger `policyUpdated` event, refreshing their recipe view immediately.
- **Merged Async Iterables**: `server/trpc/routers/permissions/subscriptions.ts` uses `mergeAsyncIterables()` helper to combine broadcast events and user-specific events into a single subscription stream.
- **Fire-and-Forget Pattern**: Leave mutation optimized to reuse already-fetched `household.users` data instead of extra `getUsersByHouseholdId` query.

**Deleted Files:**

- ❌ `actions/households.ts` - Replaced by tRPC procedures
- ❌ `app/api/household/settings/route.ts` - Replaced by `trpc.households.get`
- ❌ `hooks/use-household-settings.ts` - Replaced by `hooks/households/`
- ❌ `server/events/listeners/household-listener.ts` - No longer needed, direct emitter usage

**Tests:** 18 tests for household hooks

- `__tests__/hooks/households/use-household-query.test.ts` - 7 tests
- `__tests__/hooks/households/use-household-mutations.test.ts` - 6 tests
- `__tests__/hooks/households/use-household-subscription.test.ts` - 5 tests

### ✅ Phase 5: Admin / Server Config

**Backend:**

- `server/trpc/routers/admin/index.ts` - Admin router combining all procedures
- `server/trpc/routers/admin/config.ts` - getAllConfigs, getSecretField, getUserRole queries
- `server/trpc/routers/admin/registration.ts` - updateRegistration mutation
- `server/trpc/routers/admin/auth-providers.ts` - OIDC/GitHub/Google CRUD + test procedures
- `server/trpc/routers/admin/content-config.ts` - content indicators, units, recurrence config
- `server/trpc/routers/admin/ai-video.ts` - AI config, video config, AI test endpoint
- `server/trpc/routers/admin/permissions.ts` - permission policy (emits to permissionsEmitter)
- `server/trpc/routers/admin/system.ts` - scheduler months, restart server, restore defaults

**Frontend:**

- `hooks/admin/use-admin-query.ts` - useAdminConfigsQuery, useUserRoleQuery
- `hooks/admin/use-admin-mutations.ts` - all mutation hooks
- `hooks/admin/index.ts` - exports
- `app/(app)/settings/admin/context.tsx` - React context using tRPC hooks

**Key Design Decisions:**

- **No admin subscriptions needed** - Admin settings page is single-user, TanStack Query mutations update UI directly
- **Permission broadcasts use permissionsEmitter** - AI config changes emit `policyUpdated` so all users get updated `isAIEnabled`
- **No separate admin emitter** - Simplified architecture, only broadcast permission-related changes globally

**Deleted Files:**

- ❌ `actions/server-config.ts` - Replaced by tRPC procedures
- ❌ `app/api/admin/server-config/` - Replaced by `trpc.admin.getAllConfigs`, `trpc.admin.getSecretField`
- ❌ `app/api/admin/user-role/` - Replaced by `trpc.admin.getUserRole`
- ❌ `hooks/use-server-config.ts` - Replaced by `hooks/admin/`
- ❌ `server/events/listeners/permission-listener.ts` - No longer needed, direct emitter usage

---

## Remaining Migrations

### ✅ CalDAV Integration (COMPLETED)

**Backend:**

- `server/trpc/routers/caldav/procedures.ts` - CalDAV CRUD + sync procedures
  - `getConfig` - Fetch config without password
  - `getPassword` - Get decrypted password for editing
  - `saveConfig` - Save config (tests connection first), triggers initial sync if enabled
  - `testConnection` - Test credentials without saving
  - `checkConnection` - Test using stored credentials
  - `deleteConfig` - Delete config (optionally delete CalDAV events)
  - `getSyncStatus` - Paginated sync status list with optional status filter
  - `getSummary` - Sync status counts (pending, synced, failed, removed)
  - `triggerSync` - Manual retry of pending/failed items
  - `syncAll` - Sync all future items
- `server/trpc/routers/caldav/subscriptions.ts` - Real-time sync status updates
  - `onSyncEvent` - Discriminated union subscription (configSaved, syncStarted, syncCompleted, syncFailed, itemStatusUpdated, initialSyncComplete)
- `server/trpc/routers/caldav/emitter.ts` - User-scoped emitter (HMR-safe)
- `server/trpc/routers/caldav/types.ts` - CaldavSubscriptionEvents & Zod schemas
- `server/trpc/routers/caldav/index.ts` - Router exports
- `server/caldav/calendar-sync.ts` - Global event listener service
  - `initCaldavSync()` - Called on server startup, listens to global calendar events
  - `syncAllFutureItems(userId)` - Sync all future planned recipes and notes
  - `retryFailedSyncs(userId)` - Retry pending/failed items
- `server/caldav/sync-manager.ts` - Updated to emit caldavEmitter events on sync status changes
- `server/trpc/emitter.ts` - Added `emitGlobal()` and `globalEvent()` for server-side listeners
- `server/trpc/routers/calendar/types.ts` - Added 6 global events for CalDAV to listen to:
  - `globalRecipePlanned`, `globalRecipeDeleted`, `globalRecipeUpdated`
  - `globalNotePlanned`, `globalNoteDeleted`, `globalNoteUpdated`
- `server/trpc/routers/calendar/planned-recipes.ts` - Emits global events via `emitGlobal()`
- `server/trpc/routers/calendar/notes.ts` - Emits global events via `emitGlobal()`

**Frontend:**

- `hooks/caldav/use-caldav-query.ts` - Query hooks with cache setters
  - `useCaldavConfigQuery` - Config without password
  - `useCaldavPasswordQuery` - Password for editing (no cache)
  - `useCaldavSyncStatusQuery` - Paginated sync statuses with filter
  - `useCaldavSummaryQuery` - Status counts
  - `useCaldavConnectionQuery` - Connection status check
- `hooks/caldav/use-caldav-mutations.ts` - Fire-and-forget mutations
  - `useCaldavMutations` - saveConfig, testConnection, deleteConfig, triggerSync, syncAll
- `hooks/caldav/use-caldav-subscription.ts` - Real-time sync status updates
  - Subscribes to `onSyncEvent`, updates sync status cache on itemStatusUpdated
- `hooks/caldav/index.ts` - Barrel exports
- `app/(app)/settings/caldav/context.tsx` - Rewritten to use tRPC hooks

**Key Implementation Details:**

- **Global Event Pattern**: CalDAV needs to listen to ALL recipe/note events server-side (not just a specific household). Added `emitGlobal()` method to TypedEmitter that emits events with userId in payload.
- **Server-Side Listener**: `initCaldavSync()` uses `calendarEmitter.on(calendarEmitter.globalEvent("globalRecipePlanned"), ...)` pattern to receive events without userId scoping.
- **User-Scoped Subscriptions**: Unlike groceries/calendar which are household-scoped, CalDAV subscriptions are user-scoped (each user has their own CalDAV config).
- **Discriminated Union Events**: `onSyncEvent` yields events with `type` field for narrowing (configSaved, syncStarted, syncCompleted, syncFailed, itemStatusUpdated, initialSyncComplete).

**Deleted Files:**

- ❌ `actions/caldav.ts` - Replaced by tRPC procedures
- ❌ `app/api/caldav/config/route.ts` - Replaced by `trpc.caldav.getConfig/saveConfig`
- ❌ `app/api/caldav/sync-status/route.ts` - Replaced by `trpc.caldav.getSyncStatus/getSummary`
- ❌ `server/events/listeners/caldav-sync-listener.ts` - Replaced by `server/caldav/calendar-sync.ts`
- ❌ `server/events/types/caldav-events.ts` - Replaced by `server/trpc/routers/caldav/types.ts`
- ❌ `hooks/data/use-caldav-settings.ts` - Replaced by `hooks/caldav/`
- ❌ `types/websocket/caldav.ts` - Events now in tRPC emitter types

**Tests:** 57 tests for CalDAV

- `__tests__/trpc/caldav/procedures.test.ts` - 18 backend tests
- `__tests__/hooks/caldav/use-caldav-query.test.ts` - 14 tests
- `__tests__/hooks/caldav/use-caldav-mutations.test.ts` - 14 tests
- `__tests__/hooks/caldav/use-caldav-subscription.test.ts` - 11 tests

### ✅ Phase 9: Config, Scheduler, and Final Cleanup (COMPLETED)

**Backend:**

- `server/trpc/routers/config/index.ts` - Config router combining procedures
- `server/trpc/routers/config/procedures.ts` - tags, units, recurrenceConfig queries
- `server/startup/start-cron.ts` - Refactored to call cleanup functions directly (no eventBus)
- `server/scheduler/recurring-grocery-check.ts` - Uses groceryEmitter for broadcasting
- `server/db/repositories/households.ts` - Added `getHouseholdMemberIds` helper

**Frontend:**

- `hooks/config/index.ts` - Barrel exports
- `hooks/config/use-tags-query.ts` - tRPC tags query hook
- `hooks/config/use-units-query.ts` - tRPC units query hook
- `hooks/config/use-recurrence-config-query.ts` - tRPC recurrence config hook
- `hooks/recipes/use-recipe-ingredients.ts` - Wrapper using useRecipeQuery

**Components Updated:**

- `components/recipes/recipe-new-modal.tsx` - useTagsQuery
- `components/recipes/recipes-filter-modal.tsx` - useTagsQuery
- `components/Panel/recipe/overview-edit-form.tsx` - useTagsQuery, useUnitsQuery
- `components/Panel/recipe/ingredients-edit-form.tsx` - useUnitsQuery
- `components/Panel/recipe/ingredient-item-editable.tsx` - useUnitsQuery
- `components/shared/unit-select.tsx` - useUnitsQuery
- `hooks/use-recurrence-detection.ts` - useRecurrenceConfigQuery

**Deleted Files:**

- ❌ `app/api/tags/route.ts` - Replaced by `trpc.config.tags`
- ❌ `app/api/units/route.ts` - Replaced by `trpc.config.units`
- ❌ `app/api/recurrence-config/route.ts` - Replaced by `trpc.config.recurrenceConfig`
- ❌ `app/api/user/route.ts` - Already replaced by `trpc.user`
- ❌ `hooks/data/use-tags.ts` - Replaced by `hooks/config/use-tags-query.ts`
- ❌ `hooks/data/use-units.ts` - Replaced by `hooks/config/use-units-query.ts`
- ❌ `hooks/data/use-recipe-ingredients.tsx` - Replaced by `hooks/recipes/use-recipe-ingredients.ts`
- ❌ `server/events/` (entire directory) - Legacy event bus system
- ❌ `server/ws/` (entire directory) - Legacy WebSocket server
- ❌ `types/websocket/` (entire directory) - Legacy WebSocket types
- ❌ `context/ws-context.tsx` - WsProvider no longer needed

**Key Implementation Details:**

- **Scheduler Direct Calls**: `start-cron.ts` now directly awaits cleanup functions instead of emitting eventBus events
- **groceryEmitter for Recurring**: `recurring-grocery-check.ts` uses `groceryEmitter.emitToHousehold()` to broadcast updates
- **Config Hooks with Caching**: All config hooks use `staleTime: Infinity` since configs rarely change
- **Architecture Documentation Updated**: `.github/instructions/architecture.instructions.md` fully rewritten for tRPC patterns

---

## File Structure

```
server/trpc/
├── routers/
│   ├── groceries/
│   │   ├── index.ts
│   │   ├── groceries.ts        # list, create, update, toggle, delete
│   │   ├── recurring.ts        # createRecurring, updateRecurring, deleteRecurring, check
│   │   ├── subscriptions.ts    # onCreated, onUpdated, onDeleted, onRecurring*, onFailed
│   │   ├── emitter.ts          # groceryEmitter (global singleton)
│   │   └── types.ts            # GrocerySubscriptionEvents
│   │
│   ├── calendar/
│   │   ├── index.ts
│   │   ├── planned-recipes.ts  # listRecipes, create, delete, updateDate
│   │   ├── notes.ts            # listNotes, create, delete, updateDate
│   │   ├── subscriptions.ts    # onRecipe*, onNote*, onFailed
│   │   ├── emitter.ts          # calendarEmitter (global singleton)
│   │   └── types.ts            # CalendarSubscriptionEvents
│   │
│   ├── recipes/
│   │   ├── index.ts
│   │   ├── recipes.ts          # list, get, create, update, delete, importFromUrl, convertMeasurements
│   │   ├── images.ts           # uploadImage, deleteImage (FormData)
│   │   ├── mela.ts             # importMela (FormData, async with progress)
│   │   ├── import.ts           # Shared import logic (tRPC + REST API)
│   │   ├── subscriptions.ts    # onImportStarted, onImported, onCreated, onUpdated, onDeleted, onConverted, onFailed, onMelaProgress, onMelaCompleted
│   │   ├── emitter.ts          # recipeEmitter (global singleton)
│   │   └── types.ts            # RecipeSubscriptionEvents
│   │
│   ├── user/
│   │   ├── index.ts
│   │   ├── user.ts             # get, updateName, uploadAvatar, deleteAvatar, deleteAccount
│   │   ├── api-keys.ts         # create, delete, toggle
│   │   └── types.ts            # Zod schemas (UpdateNameInput, etc.)
│   │
│   ├── permissions/
│   │   ├── index.ts
│   │   ├── permissions.ts      # get (policy + AI status + household)
│   │   ├── subscriptions.ts    # onPolicyUpdated
│   │   ├── emitter.ts          # permissionsEmitter (global singleton)
│   │   └── types.ts            # PermissionsSubscriptionEvents
│   │
│   ├── admin/
│   │   ├── index.ts            # adminRouter export
│   │   ├── config.ts           # getAllConfigs, getSecretField, getUserRole
│   │   ├── registration.ts     # updateRegistration
│   │   ├── auth-providers.ts   # OIDC/GitHub/Google CRUD + test
│   │   ├── content-config.ts   # indicators, units, recurrence
│   │   ├── ai-video.ts         # AI config, video config, AI test
│   │   ├── permissions.ts      # recipe permission policy
│   │   └── system.ts           # scheduler, restart, restore defaults
│   │
│   ├── households/
│   │   ├── index.ts
│   │   ├── households.ts       # get, create, join, leave, kick, regenerateCode, transferAdmin
│   │   ├── subscriptions.ts    # onCreated, onJoined, onLeft, onKicked, onCodeRegenerated, onAdminTransferred, onMemberAdded, onFailed
│   │   ├── emitter.ts          # householdsEmitter (global singleton)
│   │   └── types.ts            # HouseholdSubscriptionEvents
│   │
│   ├── caldav/
│   │   ├── index.ts
│   │   ├── procedures.ts       # getConfig, getPassword, saveConfig, testConnection, checkConnection, deleteConfig, getSyncStatus, getSummary, triggerSync, syncAll
│   │   ├── subscriptions.ts    # onSyncEvent (discriminated union)
│   │   ├── emitter.ts          # caldavEmitter (user-scoped, HMR-safe)
│   │   └── types.ts            # CaldavSubscriptionEvents
│   │
│   ├── config/
│   │   ├── index.ts
│   │   └── procedures.ts       # tags, units, recurrenceConfig queries
│   │
│   └── ... (other routers)
│
hooks/
├── groceries/
│   ├── index.ts
│   ├── use-groceries-query.ts
│   ├── use-groceries-mutations.ts
│   └── use-groceries-subscription.ts
│
├── calendar/
│   ├── index.ts
│   ├── use-calendar-query.ts
│   ├── use-calendar-mutations.ts
│   └── use-calendar-subscription.ts
│
├── recipes/
│   ├── index.ts
│   ├── use-recipes-query.ts       # Infinite query with filters
│   ├── use-recipe-query.ts        # Single recipe query
│   ├── use-recipes-mutations.ts
│   ├── use-recipes-subscription.tsx
│   ├── use-recipe-subscription.tsx # Single recipe updates
│   └── use-mela-import.ts         # Mela import with persistent state
│
├── user/
│   ├── index.ts
│   ├── use-user-query.ts          # User profile + API keys query
│   └── use-user-mutations.ts      # name, avatar, API keys, delete account
│
├── admin/
│   ├── index.ts
│   ├── use-admin-query.ts         # useAdminConfigsQuery, useUserRoleQuery
│   └── use-admin-mutations.ts     # All admin config mutations
│
├── households/
│   ├── index.ts
│   ├── use-household-query.ts     # Household settings query
│   ├── use-household-mutations.ts # create, join, leave, kick, regenerateCode, transferAdmin
│   └── use-household-subscription.ts # All 8 subscriptions
│
├── caldav/
│   ├── index.ts
│   ├── use-caldav-query.ts        # Config, password, sync status, summary, connection queries
│   ├── use-caldav-mutations.ts    # saveConfig, testConnection, deleteConfig, triggerSync, syncAll
│   └── use-caldav-subscription.ts # onSyncEvent subscription
│
├── data/
│   ├── use-permissions.ts         # tRPC query + subscription
│   ├── use-tags.ts                # SWR (to migrate)
│   └── use-units.ts               # SWR (to migrate)
│
types/
├── uploads.ts                     # Shared image upload types + Mela event types
│   ├── ALLOWED_IMAGE_MIME_TYPES/SET
│   ├── IMAGE_MIME_TO_EXTENSION
│   ├── MAX_AVATAR_SIZE, MAX_RECIPE_IMAGE_SIZE
│   └── MelaImportError, MelaProgressPayload, MelaCompletedPayload
```

---

## Common Gotchas

### 1. HMR Creates Multiple Emitters

**Problem:** In development, HMR creates new emitter instances, breaking subscriptions.
**Solution:** Use `globalThis` to persist emitters across HMR.

### 2. setQueryData Updates Wrong Key

**Problem:** `setQueryData` on a combined key doesn't trigger re-renders if data is derived from separate queries.
**Solution:** Read from the combined key in useMemo and merge with query data.

### 3. Async Mutations Block UI

**Problem:** Using `await mutateAsync()` blocks the UI thread.
**Solution:** Use `mutate()` with `onSuccess`/`onError` callbacks.

### 4. Context Types Expect Promises

**Problem:** Context types defined with `Promise<T>` return types don't match fire-and-forget pattern.
**Solution:** Update context types to `void` return types.

### 5. Subscription listenerCount is 0

**Problem:** Events emit but no listeners receive them.
**Solution:** Ensure using the same global emitter instance (see #1).

### 6. Admin Pages Don't Need Subscriptions

**Problem:** Initially added admin subscriptions for config updates, but this is unnecessary.
**Solution:** Admin settings pages are single-user. TanStack Query mutations update UI directly via `onSuccess`. Only broadcast to `permissionsEmitter` for changes that affect all users (like AI enabled state).

---

## Test Summary

```
Total: 311 tests passing
- Groceries hooks: 23 tests
- Calendar hooks: 26 tests
- Recipes hooks: 30 tests
- Household hooks: 18 tests
- User hooks: 9 tests
- CalDAV hooks: 39 tests
- Admin procedures: 11 tests
- User procedures: 10 tests
- CalDAV procedures: 18 tests
- Mela import: 12 tests
- Helper functions: 17 tests
- Permissions: 13 tests
- Recurrence calculator: 24 tests
- tRPC procedures: 61 tests
```
