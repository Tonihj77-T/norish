import type { RecipePermissionPolicy } from "@/server/db/zodSchemas/server-config";

/**
 * Permissions subscription event payloads.
 */
export type PermissionsSubscriptionEvents = {
  /** Permission policy updated */
  policyUpdated: { recipePolicy: RecipePermissionPolicy };
};
