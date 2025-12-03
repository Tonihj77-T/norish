import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { notes } from "@/server/db/schema";

export const NoteSelectBaseSchema = createSelectSchema(notes);

export const noteViewSchema = createSelectSchema(notes).omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const NoteInsertBaseSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const NoteUpdateBaseSchema = createUpdateSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Derived schemas for tRPC routers
export const NoteListSchema = z.object({
  startISO: NoteSelectBaseSchema.shape.date,
  endISO: NoteSelectBaseSchema.shape.date,
});

export const NoteCreateSchema = NoteInsertBaseSchema.pick({
  date: true,
  slot: true,
  title: true,
});

export const NoteDeleteSchema = NoteSelectBaseSchema.pick({
  id: true,
  date: true,
});

export const NoteUpdateDateSchema = NoteSelectBaseSchema.pick({
  id: true,
}).extend({
  newDate: NoteSelectBaseSchema.shape.date,
  oldDate: NoteSelectBaseSchema.shape.date,
});
