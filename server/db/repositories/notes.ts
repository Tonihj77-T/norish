import type { NoteViewDto } from "@/types";

import { and, desc, eq, gte, lte, inArray, sql } from "drizzle-orm";
import z from "zod";

import { db } from "@/server/db/drizzle";
import { notes } from "@/server/db/schema";
import { NoteInsertBaseSchema, noteViewSchema } from "@/server/db/zodSchemas";

export async function listNotesByUserAndRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<NoteViewDto[]> {
  const start = new Date(startISO);
  const end = new Date(endISO);

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      recipeId: notes.recipeId,
      date: sql<string>`to_char(${notes.date}, 'YYYY-MM-DD')`,
      slot: notes.slot,
    })
    .from(notes)
    .where(
      and(eq(notes.userId, userId), gte(notes.date, start as any), lte(notes.date, end as any))
    )
    .orderBy(desc(notes.date));

  const parsed = z.array(noteViewSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse notes");

  return parsed.data;
}

export async function listNotesByUsersAndRange(
  userIds: string[],
  startISO: string,
  endISO: string
): Promise<NoteViewDto[]> {
  if (!userIds.length) return [];

  const start = new Date(startISO);
  const end = new Date(endISO);

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      recipeId: notes.recipeId,
      date: sql<string>`to_char(${notes.date}, 'YYYY-MM-DD')`,
      slot: notes.slot,
    })
    .from(notes)
    .where(
      and(
        inArray(notes.userId, userIds),
        gte(notes.date, start as any),
        lte(notes.date, end as any)
      )
    )
    .orderBy(desc(notes.date));

  const parsed = z.array(noteViewSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse notes");

  return parsed.data;
}

export async function getNoteViewById(id: string): Promise<NoteViewDto | null> {
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      recipeId: notes.recipeId,
      date: sql<string>`to_char(${notes.date}, 'YYYY-MM-DD')`,
      slot: notes.slot,
    })
    .from(notes)
    .where(eq(notes.id, id))
    .limit(1);

  if (!row) return null;

  const parsed = noteViewSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse note");

  return parsed.data;
}

export async function createNote(
  id: string,
  userId: string,
  title: string,
  date: string,
  slot: string
): Promise<NoteViewDto> {
  const input = {
    userId,
    title,
    date,
    slot,
    recipeId: null,
  };

  const parsed = NoteInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid note data");

  const [inserted] = await db
    .insert(notes)
    .values({ id, ...(parsed.data as any) })
    .returning({ id: notes.id });

  if (!inserted.id) throw new Error("Failed to create note");

  return (await getNoteViewById(inserted.id)) as NoteViewDto;
}

export async function deleteNote(id: string): Promise<void> {
  await db.delete(notes).where(eq(notes.id, id));
}

export async function updateNoteDate(id: string, newDate: string): Promise<NoteViewDto> {
  await db
    .update(notes)
    .set({
      date: newDate,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id));

  return (await getNoteViewById(id)) as NoteViewDto;
}

export async function deleteNotesBefore(beforeDate: string): Promise<number> {
  const beforeDateObj = new Date(beforeDate);
  const result = await db.delete(notes).where(lte(notes.date, beforeDateObj as any));

  return result.rowCount ?? 0;
}

export async function getFutureNotes(fromDate: string) {
  const rows = await db
    .select()
    .from(notes)
    .where(gte(notes.date, fromDate as any));

  return rows;
}

/**
 * Get the owner userId for a note (for permission checks)
 */
export async function getNoteOwnerId(noteId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: notes.userId })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  return row?.userId ?? null;
}
