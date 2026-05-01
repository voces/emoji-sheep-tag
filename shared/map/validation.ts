import z from "zod";
import { unpackMap2D } from "../util/2dPacking.ts";
import { unpackEntities } from "../util/entityPacking.ts";
import { generateMapTags } from "../maps/tags.ts";

export const MAP_LIMITS = {
  MIN_WIDTH: 16,
  MAX_WIDTH: 256,
  MIN_HEIGHT: 16,
  MAX_HEIGHT: 256,
  MAX_ENTITIES: 10000,
} as const;

const zPackedMap = z.object({
  center: z.object({
    x: z.number(),
    y: z.number(),
  }),
  bounds: z.object({
    min: z.object({
      x: z.number(),
      y: z.number(),
    }),
    max: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }),
  terrain: z.string(),
  cliffs: z.string(),
  water: z.string().optional(),
  mask: z.string().optional(),
  entities: z.string().optional(),
  tags: z.array(z.string()).readonly().optional(),
});

export type MapValidationError =
  | { type: "invalid_structure"; message: string }
  | { type: "width_too_small"; min: number; actual: number }
  | { type: "width_too_large"; max: number; actual: number }
  | { type: "height_too_small"; min: number; actual: number }
  | { type: "height_too_large"; max: number; actual: number }
  | { type: "entity_count_exceeded"; max: number; actual: number }
  | { type: "terrain_size_mismatch"; expected: string; actual: string }
  | { type: "no_tags" };

export const validatePackedMap = (
  map: unknown,
): { valid: true } | { valid: false; errors: MapValidationError[] } => {
  const errors: MapValidationError[] = [];

  const result = zPackedMap.safeParse(map);
  if (!result.success) {
    errors.push({
      type: "invalid_structure",
      message: result.error.issues.map((e) => e.message).join(", "),
    });
    return { valid: false, errors };
  }

  const packed = result.data;

  try {
    const terrain = unpackMap2D(packed.terrain);
    const cliffs = unpackMap2D(packed.cliffs);

    const height = terrain.length;
    const width = terrain[0]?.length ?? 0;

    if (width < MAP_LIMITS.MIN_WIDTH) {
      errors.push({
        type: "width_too_small",
        min: MAP_LIMITS.MIN_WIDTH,
        actual: width,
      });
    }

    if (width > MAP_LIMITS.MAX_WIDTH) {
      errors.push({
        type: "width_too_large",
        max: MAP_LIMITS.MAX_WIDTH,
        actual: width,
      });
    }

    if (height < MAP_LIMITS.MIN_HEIGHT) {
      errors.push({
        type: "height_too_small",
        min: MAP_LIMITS.MIN_HEIGHT,
        actual: height,
      });
    }

    if (height > MAP_LIMITS.MAX_HEIGHT) {
      errors.push({
        type: "height_too_large",
        max: MAP_LIMITS.MAX_HEIGHT,
        actual: height,
      });
    }

    const cliffHeight = cliffs.length;
    const cliffWidth = cliffs[0]?.length ?? 0;

    if (cliffHeight !== height || cliffWidth !== width) {
      errors.push({
        type: "terrain_size_mismatch",
        expected: `${width}x${height}`,
        actual: `${cliffWidth}x${cliffHeight}`,
      });
    }

    if (packed.entities) {
      const entities = unpackEntities(packed.entities);
      if (entities.length > MAP_LIMITS.MAX_ENTITIES) {
        errors.push({
          type: "entity_count_exceeded",
          max: MAP_LIMITS.MAX_ENTITIES,
          actual: entities.length,
        });
      }
    }

    // Validate tag presence by re-deriving from terrain so a missing or empty
    // tags field can't smuggle in an unqualified map.
    if (generateMapTags(terrain).length === 0) {
      errors.push({ type: "no_tags" });
    }
  } catch (err) {
    errors.push({
      type: "invalid_structure",
      message: err instanceof Error ? err.message : "Failed to unpack map data",
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};
