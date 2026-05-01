import z from "zod";
import { zUpdate } from "../../client/schemas.ts";
import { lookup } from "../systems/lookup.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { pathingMap } from "../systems/pathing.ts";
import {
  getCliffs,
  getMap,
  getMask,
  getTiles,
  getWater,
  isMaskEmpty,
  reanchorMask,
  setCurrentMap,
} from "@/shared/map.ts";
import {
  updatePathingForCliff,
  updatePathingForCliffs,
} from "@/shared/pathing/updatePathingForCliff.ts";
import { getEntityShiftForResize, resizeMap } from "@/shared/map/resizeMap.ts";
import { appContext } from "@/shared/context.ts";
import { packMap2D, packMap2DAuto } from "@/shared/util/2dPacking.ts";
import { tileDefs } from "@/shared/data.ts";
import { send } from "../lobbyApi.ts";
import { flushUpdates } from "../updates.ts";
import { getPathingMaskFromTerrainMasks } from "@/shared/pathing/terrainHelpers.ts";

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
    if (existing) return Object.assign(existing, entity);
  }
  addEntity(entity);
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
  tile: z.number().optional(),
});

export const editorSetPathing = (
  _: unknown,
  { x, y, pathing, tile }: z.output<typeof zEditorSetPathing>,
) => {
  // Note: pathing coordinates are in terrain coordinates (terrain[0] = bottom)
  // which matches the PathingMap coordinate system, so no conversion needed for pathing
  pathingMap().setPathing(x, y, pathing, pathingMap().resolution);

  // Update tile type if provided (tiles use map coordinates where map[0] = top)
  if (tile !== undefined) {
    const tiles = getTiles();
    const mapY = tiles.length - 1 - y;
    if (tiles[mapY]?.[x] !== undefined) {
      tiles[mapY][x] = tile;
    }
  }
};

export const zEditorBulkSetTiles = z.object({
  type: z.literal("editorBulkSetTiles"),
  cells: z.array(z.tuple([z.number(), z.number()])),
  tile: z.number().int().nonnegative(),
  pathing: z.number().int().nonnegative(),
});

export const editorBulkSetTiles = (
  _: unknown,
  { cells, tile, pathing }: z.output<typeof zEditorBulkSetTiles>,
) => {
  const tiles = getTiles();
  const pm = pathingMap();
  const mapH = tiles.length;
  for (const [x, y] of cells) {
    const mapY = mapH - 1 - y;
    if (tiles[mapY]?.[x] !== undefined) tiles[mapY][x] = tile;
    pm.setPathing(x, y, pathing, pm.resolution);
  }
};

export const zEditorSetCliff = z.object({
  type: z.literal("editorSetCliff"),
  x: z.number(),
  y: z.number(),
  cliff: z.union([z.number(), z.literal("r")]),
});

export const zEditorSetWater = z.object({
  type: z.literal("editorSetWater"),
  x: z.number(),
  y: z.number(),
  /** Raw water value (integer * WATER_LEVEL_SCALE). 0 = no water. */
  water: z.number().int().nonnegative(),
});

export const editorSetCliff = (
  _: unknown,
  { x, y, cliff }: z.output<typeof zEditorSetCliff>,
) => {
  const cliffs = getCliffs();
  const tiles = getTiles();
  const water = getWater();
  const mask = getMask();
  const { bounds } = getMap();

  // Convert from world coordinates (y=0 is bottom) to map coordinates (map[0] = top)
  const mapY = cliffs.length - 1 - y;

  // Update server's cliff data
  if (cliffs[mapY]?.[x] !== undefined) cliffs[mapY][x] = cliff;

  // Update pathing map for the changed cliff (updatePathingForCliff expects world coordinates)
  updatePathingForCliff(
    pathingMap(),
    tiles,
    cliffs,
    water,
    x,
    y,
    bounds,
    mask,
  );
};

export const editorSetWater = (
  _: unknown,
  { x, y, water: value }: z.output<typeof zEditorSetWater>,
) => {
  const cliffs = getCliffs();
  const tiles = getTiles();
  const water = getWater();
  const mask = getMask();
  const { bounds } = getMap();

  // Convert from world coordinates (y=0 is bottom) to map coordinates (map[0] = top)
  const mapY = water.length - 1 - y;

  if (water[mapY]?.[x] === undefined) return;
  water[mapY][x] = value;

  updatePathingForCliff(
    pathingMap(),
    tiles,
    cliffs,
    water,
    x,
    y,
    bounds,
    mask,
  );
};

export const zEditorBulkSetCliffs = z.object({
  type: z.literal("editorBulkSetCliffs"),
  cells: z.array(z.object({
    x: z.number(),
    y: z.number(),
    cliff: z.union([z.number(), z.literal("r")]),
  })),
});

export const editorBulkSetCliffs = (
  _: unknown,
  { cells }: z.output<typeof zEditorBulkSetCliffs>,
) => {
  const cliffs = getCliffs();
  const tiles = getTiles();
  const water = getWater();
  const mask = getMask();
  const { bounds } = getMap();
  for (const { x, y, cliff } of cells) {
    const mapY = cliffs.length - 1 - y;
    if (cliffs[mapY]?.[x] !== undefined) cliffs[mapY][x] = cliff;
  }
  updatePathingForCliffs(
    pathingMap(),
    tiles,
    cliffs,
    water,
    cells.map(({ x, y }) => [x, y] as const),
    bounds,
    mask,
  );
};

export const zEditorBulkSetWaters = z.object({
  type: z.literal("editorBulkSetWaters"),
  cells: z.array(z.object({
    x: z.number(),
    y: z.number(),
    water: z.number().int().nonnegative(),
  })),
});

/**
 * `mapX` / `mapY` are mask-array indices (mask cells are anchored to the
 * boundary, not to terrain). Cells outside the mask grid are silently
 * ignored — that's the documented "noop outside boundary" behavior.
 */
export const zEditorSetMask = z.object({
  type: z.literal("editorSetMask"),
  mapX: z.number().int().nonnegative(),
  mapY: z.number().int().nonnegative(),
  value: z.number().int().nonnegative(),
});

export const zEditorBulkSetMasks = z.object({
  type: z.literal("editorBulkSetMasks"),
  cells: z.array(z.object({
    mapX: z.number().int().nonnegative(),
    mapY: z.number().int().nonnegative(),
    value: z.number().int().nonnegative(),
  })),
});

export const editorBulkSetWaters = (
  _: unknown,
  { cells }: z.output<typeof zEditorBulkSetWaters>,
) => {
  const cliffs = getCliffs();
  const tiles = getTiles();
  const water = getWater();
  const mask = getMask();
  const { bounds } = getMap();
  const updated: Array<readonly [number, number]> = [];
  for (const { x, y, water: value } of cells) {
    const mapY = water.length - 1 - y;
    if (water[mapY]?.[x] === undefined) continue;
    water[mapY][x] = value;
    updated.push([x, y]);
  }
  updatePathingForCliffs(
    pathingMap(),
    tiles,
    cliffs,
    water,
    updated,
    bounds,
    mask,
  );
};

/**
 * Mask cell (mapY, mapX) sits on the cliff vertex at world (vx, vy) and
 * affects the up-to-four cliff cells sharing that vertex. Returned as
 * (worldX, worldY) tile coords for `updatePathingForCliffs`.
 */
const maskCellAffectedCliffCells = (
  mapY: number,
  mapX: number,
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
  mapWidth: number,
  mapHeight: number,
): Array<readonly [number, number]> => {
  const firstVertexX = Math.ceil(bounds.min.x);
  const topVertexY = Math.ceil(bounds.max.y) - 1;
  const vx = firstVertexX + mapX;
  const vy = topVertexY - mapY;
  const out: Array<readonly [number, number]> = [];
  for (const cx of [vx - 1, vx]) {
    if (cx < 0 || cx >= mapWidth) continue;
    for (const cy of [vy - 1, vy]) {
      if (cy < 0 || cy >= mapHeight) continue;
      out.push([cx, cy] as const);
    }
  }
  return out;
};

export const editorSetMask = (
  _: unknown,
  { mapX, mapY, value }: z.output<typeof zEditorSetMask>,
) => {
  const map = getMap();
  if (mapY < 0 || mapY >= map.mask.length) return;
  const row = map.mask[mapY];
  if (!row || mapX < 0 || mapX >= row.length) return;
  row[mapX] = value;
  const affected = maskCellAffectedCliffCells(
    mapY,
    mapX,
    map.bounds,
    map.width,
    map.height,
  );
  updatePathingForCliffs(
    pathingMap(),
    map.tiles,
    map.cliffs,
    map.water,
    affected,
    map.bounds,
    map.mask,
  );
};

export const editorBulkSetMasks = (
  _: unknown,
  { cells }: z.output<typeof zEditorBulkSetMasks>,
) => {
  const map = getMap();
  const affected: Array<readonly [number, number]> = [];
  for (const { mapX, mapY, value } of cells) {
    if (mapY < 0 || mapY >= map.mask.length) continue;
    const row = map.mask[mapY];
    if (!row || mapX < 0 || mapX >= row.length) continue;
    row[mapX] = value;
    affected.push(
      ...maskCellAffectedCliffCells(
        mapY,
        mapX,
        map.bounds,
        map.width,
        map.height,
      ),
    );
  }
  if (affected.length === 0) return;
  updatePathingForCliffs(
    pathingMap(),
    map.tiles,
    map.cliffs,
    map.water,
    affected,
    map.bounds,
    map.mask,
  );
};

export const zEditorResizeMap = z.object({
  type: z.literal("editorResizeMap"),
  direction: z.enum(["top", "bottom", "left", "right"]),
  amount: z.number(),
});

export const zEditorAdjustBounds = z.object({
  type: z.literal("editorAdjustBounds"),
  direction: z.enum(["top", "bottom", "left", "right"]),
  amount: z.number(),
});

export const editorResizeMap = (
  _: unknown,
  { direction, amount }: z.output<typeof zEditorResizeMap>,
) => {
  const currentMap = getMap();
  const newMap = resizeMap(currentMap, { direction, amount });

  // Get entity shift for this resize
  const shift = getEntityShiftForResize({ direction, amount });

  // Update all existing entities' positions if needed
  if (shift.x !== 0 || shift.y !== 0) {
    for (const entity of appContext.current.entities) {
      if (entity.position) {
        entity.position = {
          x: entity.position.x + shift.x,
          y: entity.position.y + shift.y,
        };
      }
    }
  }

  // Remove entities that fall outside the new terrain bounds
  const entitiesToRemove = [];
  for (const entity of appContext.current.entities) {
    if (!entity.position) continue;
    if (entity.isPlayer) continue; // Don't remove players

    const { x, y } = entity.position;
    // Check if entity is outside the new terrain size (0.5 to width-0.5, 0.5 to height-0.5)
    if (
      x < 0.5 || x >= newMap.width - 0.5 || y < 0.5 || y >= newMap.height - 0.5
    ) entitiesToRemove.push(entity);
  }

  // Send delete orders for entities outside bounds
  for (const entity of entitiesToRemove) {
    appContext.current.removeEntity(entity);
  }
  if (entitiesToRemove.length) {
    send({
      type: "chat",
      message: `${entitiesToRemove.length} out of bounds entities removed.`,
    });
  }

  // Apply the new map with a new ID to force update
  // (setMapForApp skips updates if the map ID hasn't changed)
  setCurrentMap({
    ...newMap,
    id: `${newMap.id}-resized-${Date.now()}`,
  });

  // Broadcast terrain update to all clients
  // Calculate maxCliff for packing
  let maxCliff = 0;
  const cliffsForPacking = newMap.cliffs.map((row) =>
    row.map((value) => {
      if (value === "r") return 0;
      if (value >= maxCliff) maxCliff = value;
      return value + 1;
    })
  );

  const packedTerrain = packMap2D(newMap.tiles, tileDefs.length);
  const packedCliffs = packMap2D(cliffsForPacking, maxCliff + 1);
  const packedWater = packMap2DAuto(newMap.water);

  send({
    type: "mapUpdate",
    terrain: packedTerrain,
    cliffs: packedCliffs,
    water: packedWater,
    mask: isMaskEmpty(newMap.mask) ? undefined : packMap2DAuto(newMap.mask),
    width: newMap.width,
    height: newMap.height,
    bounds: newMap.bounds,
    center: newMap.center,
  });

  // Send entity position updates immediately so fog system has correct positions
  const entityUpdates = flushUpdates(false);
  if (entityUpdates.length > 0) {
    send({ type: "updates", updates: entityUpdates });
  }
};

export const editorAdjustBounds = (
  _: unknown,
  { direction, amount }: z.output<typeof zEditorAdjustBounds>,
) => {
  const currentMap = getMap();

  // Adjust bounds without changing terrain
  const newBounds = {
    min: { x: currentMap.bounds.min.x, y: currentMap.bounds.min.y },
    max: { x: currentMap.bounds.max.x, y: currentMap.bounds.max.y },
  };

  switch (direction) {
    case "top":
      newBounds.max.y += amount;
      break;
    case "bottom":
      newBounds.min.y -= amount;
      break;
    case "left":
      newBounds.min.x -= amount;
      break;
    case "right":
      newBounds.max.x += amount;
      break;
  }

  // Re-anchor the manual mask to the new bounds. Cells outside the new bounds
  // are dropped (so shrinking the boundary clears the manual masking that's
  // now out-of-bounds), new cells from expansion start unset.
  const newMask = reanchorMask(currentMap.mask, currentMap.bounds, newBounds);

  // Rebuild terrain pathing and layers (these will be recalculated)
  const rawPathing = getPathingMaskFromTerrainMasks(
    currentMap.tiles,
    currentMap.cliffs,
    currentMap.water,
    newBounds,
    newMask,
  );
  const terrainPathingMap = rawPathing.toReversed();

  const updatedMap = {
    ...currentMap,
    id: `${currentMap.id}-bounds-${Date.now()}`,
    bounds: newBounds,
    mask: newMask,
    terrainPathingMap,
  };

  setCurrentMap(updatedMap);

  // Broadcast bounds update to all clients
  send({
    type: "mapUpdate",
    terrain: packMap2D(currentMap.tiles, tileDefs.length),
    cliffs: packMap2D(
      (() => {
        let maxCliff = 0;
        return currentMap.cliffs.map((row) =>
          row.map((value) => {
            if (value === "r") return 0;
            if (value >= maxCliff) maxCliff = value;
            return value + 1;
          })
        );
      })(),
      (() => {
        let maxCliff = 0;
        currentMap.cliffs.forEach((row) =>
          row.forEach((value) => {
            if (value !== "r" && value >= maxCliff) maxCliff = value;
          })
        );
        return maxCliff + 1;
      })(),
    ),
    water: packMap2DAuto(currentMap.water),
    mask: isMaskEmpty(newMask) ? undefined : packMap2DAuto(newMask),
    width: currentMap.width,
    height: currentMap.height,
    bounds: newBounds,
    center: currentMap.center,
  });
};
