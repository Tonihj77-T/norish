import type { GroceryDto, GroceryInsertDto, GroceryUpdateDto } from "@/types/dto/groceries";

import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import z from "zod";

import { db } from "@/server/db/drizzle";
import { groceries, householdUsers } from "@/server/db/schema";
import {
  GroceryInsertBaseSchema,
  GrocerySelectBaseSchema,
  GroceryUpdateBaseSchema,
} from "@/server/db/zodSchemas";

export async function getGroceryById(id: string): Promise<GroceryDto | null> {
  const [row] = await db.select().from(groceries).where(eq(groceries.id, id)).limit(1);

  if (!row) return null;

  const parsed = GrocerySelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse grocery by id");

  return parsed.data;
}

export async function getGroceriesByIds(ids: string[]): Promise<GroceryDto[]> {
  if (ids.length === 0) return [];

  const rows = await db.select().from(groceries).where(inArray(groceries.id, ids));

  const parsed = z.array(GrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse groceries by ids");

  return parsed.data;
}

export async function listGroceriesByUser(
  userId: string,
  options?: { includeDone?: boolean }
): Promise<GroceryDto[]> {
  const includeDone = options?.includeDone ?? true;

  const rows = await db
    .select()
    .from(groceries)
    .where(
      includeDone
        ? eq(groceries.userId, userId)
        : and(eq(groceries.userId, userId), eq(groceries.isDone, false))
    )
    .orderBy(desc(groceries.createdAt));

  const parsed = z.array(GrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse groceries");

  return parsed.data;
}

export async function listGroceriesByUsers(
  userIds: string[],
  options?: { includeDone?: boolean }
): Promise<GroceryDto[]> {
  if (!userIds.length) return [];
  const includeDone = options?.includeDone ?? true;

  const rows = await db
    .select()
    .from(groceries)
    .where(
      includeDone
        ? inArray(groceries.userId, userIds)
        : and(inArray(groceries.userId, userIds), eq(groceries.isDone, false))
    )
    .orderBy(desc(groceries.createdAt));

  const parsed = z.array(GrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse groceries (users)");

  return parsed.data;
}

export async function listGroceriesByHousehold(
  householdId: string,
  options?: { includeDone?: boolean }
): Promise<GroceryDto[]> {
  const members = await db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(eq(householdUsers.householdId, householdId));

  const userIds = members.map((m) => m.userId);

  if (!userIds.length) return [];

  return listGroceriesByUsers(userIds, options);
}

export async function createGroceries(
  items: { id: string; groceries: GroceryInsertDto }[]
): Promise<GroceryDto[]> {
  if (!items.length) return [];

  const prepared = items.map(({ id, groceries }) => {
    const parsed = GroceryInsertBaseSchema.safeParse(groceries);

    if (!parsed.success) {
      throw new Error("Invalid GroceryInsertDto in batch");
    }

    return { ...parsed.data, id };
  });

  const inserted = await db
    .insert(groceries)
    .values(prepared.map((p) => p as any))
    .returning();

  const parsed = z.array(GrocerySelectBaseSchema).safeParse(inserted);

  if (!parsed.success) throw new Error("Failed to parse created groceries");

  return parsed.data;
}

export async function createGrocery(id: string, input: GroceryInsertDto): Promise<GroceryDto> {
  const parsed = GroceryInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid GroceryInsertDto");

  const [row] = await db
    .insert(groceries)
    .values({ id, ...(parsed.data as any) })
    .returning();

  const validated = GrocerySelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created grocery");

  return validated.data;
}

export async function updateGrocery(input: GroceryUpdateDto): Promise<GroceryDto | null> {
  const parsed = GroceryUpdateBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid GroceryUpdateDto");

  const [row] = await db
    .update(groceries)
    .set(parsed.data as any)
    .where(eq(groceries.id, input.id))
    .returning();

  if (!row) return null;
  const validated = GrocerySelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse updated grocery");

  return validated.data;
}

export async function updateGroceries(input: GroceryUpdateDto[]): Promise<GroceryDto[]> {
  const parsed = z.array(GroceryUpdateBaseSchema).safeParse(input);

  if (!parsed.success) throw new Error("Invalid GroceryUpdateDto array");

  return await db.transaction(async (trx) => {
    const updatedGroceries: GroceryDto[] = [];

    for (const g of parsed.data) {
      const [row] = await trx
        .update(groceries)
        .set(g as any)
        .where(eq(groceries.id, g.id))
        .returning();

      if (row) {
        const validated = GrocerySelectBaseSchema.safeParse(row);

        if (!validated.success) {
          throw new Error(`Failed to parse updated grocery (id=${g.id})`);
        }
        updatedGroceries.push(validated.data);
      }
    }

    return updatedGroceries;
  });
}

export async function toggleGrocery(id: string, isDone?: boolean): Promise<GroceryDto | null> {
  const current = await db
    .select({ id: groceries.id, isDone: groceries.isDone })
    .from(groceries)
    .where(eq(groceries.id, id))
    .limit(1);

  if (!current[0]) return null;

  const next = typeof isDone === "boolean" ? isDone : !current[0].isDone;

  const [row] = await db
    .update(groceries)
    .set({ isDone: next })
    .where(eq(groceries.id, id))
    .returning();

  if (!row) return null;
  const validated = GrocerySelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse toggled grocery");

  return validated.data;
}

export async function deleteGroceryById(id: string): Promise<void> {
  await db.delete(groceries).where(eq(groceries.id, id));
}

export async function deleteGroceryByIds(ids: string[]): Promise<void> {
  await db.delete(groceries).where(inArray(groceries.id, ids));
}

export async function deleteDoneGroceriesBefore(beforeDate: string): Promise<number> {
  const beforeDateObj = new Date(beforeDate);
  const result = await db
    .delete(groceries)
    .where(
      and(
        eq(groceries.isDone, true),
        lte(groceries.updatedAt, beforeDateObj),
        isNull(groceries.recurringGroceryId)
      )
    );

  return result.rowCount ?? 0;
}

/**
 * Get the owner userId for a single grocery item (for permission checks)
 */
export async function getGroceryOwnerId(groceryId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: groceries.userId })
    .from(groceries)
    .where(eq(groceries.id, groceryId))
    .limit(1);

  return row?.userId ?? null;
}

/**
 * Get the owner userIds for multiple grocery items (for permission checks)
 * Returns a Map of groceryId -> userId
 */
export async function getGroceryOwnerIds(groceryIds: string[]): Promise<Map<string, string>> {
  if (groceryIds.length === 0) return new Map();

  const rows = await db
    .select({ id: groceries.id, userId: groceries.userId })
    .from(groceries)
    .where(inArray(groceries.id, groceryIds));

  return new Map(rows.map((r) => [r.id, r.userId]));
}
