import z from "zod";
import { zUpdate } from "../../client/schemas.ts";
import { lookup } from "../systems/lookup.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { pathingMap } from "../systems/pathing.ts";

export const zEditorCreateEntity = z.object({
  type: z.literal("editorCreateEntity"),
  entity: zUpdate.extend({ id: z.string().optional() }),
});

export const editorCreateEntity = (
  _: unknown,
  { entity }: z.TypeOf<typeof zEditorCreateEntity>,
) => {
  if (entity.id) {
    const existing = lookup(entity.id);
    if (!existing) return;
    Object.assign(existing, entity);
  } else addEntity(entity);
};

export const zEditorUpdateEntities = z.object({
  type: z.literal("editorUpdateEntities"),
  entities: zUpdate.array(),
});

export const editorUpdateEntities = (
  _: unknown,
  { entities }: z.TypeOf<typeof zEditorUpdateEntities>,
) => {
  for (const entity of entities) {
    const existing = lookup(entity.id);
    if (!existing) continue;
    Object.assign(existing, entity);
  }
};

export const zEditorSetPathing = z.object({
  type: z.literal("editorSetPathing"),
  x: z.number(),
  y: z.number(),
  pathing: z.number(),
});

export const editorSetPathing = (
  _: unknown,
  { x, y, pathing }: z.output<typeof zEditorSetPathing>,
) => pathingMap().setPathing(x, y, pathing);
