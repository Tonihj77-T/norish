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
