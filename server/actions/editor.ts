import z from "zod";
import { zUpdate } from "../../client/schemas.ts";
import { lookup } from "../systems/lookup.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { pathingMap } from "../systems/pathing.ts";
import { getCliffs, getMap, getTiles, setCurrentMap } from "@/shared/map.ts";
import { updatePathingForCliff } from "@/shared/pathing/updatePathingForCliff.ts";
import { getEntityShiftForResize, resizeMap } from "@/shared/map/resizeMap.ts";
import { appContext } from "@/shared/context.ts";
import { packMap2D } from "@/shared/util/2dPacking.ts";
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

export const zEditorSetCliff = z.object({
  type: z.literal("editorSetCliff"),
  x: z.number(),
  y: z.number(),
  cliff: z.union([z.number(), z.literal("r")]),
});

export const editorSetCliff = (
  _: unknown,
  { x, y, cliff }: z.output<typeof zEditorSetCliff>,
) => {
  const cliffs = getCliffs();
  const tiles = getTiles();

  // Convert from terrain coordinates (terrain[0] = bottom) to map coordinates (map[0] = top)
  const mapY = cliffs.length - 1 - y;

  // Update server's cliff data
  if (cliffs[mapY]?.[x] !== undefined) cliffs[mapY][x] = cliff;

  // Update pathing map for the changed cliff (updatePathingForCliff expects map coordinates)
  updatePathingForCliff(pathingMap(), tiles, cliffs, x, mapY);
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

  send({
    type: "mapUpdate",
    terrain: packedTerrain,
    cliffs: packedCliffs,
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
  const newBounds = { ...currentMap.bounds };

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

  // Rebuild terrain pathing and layers (these will be recalculated)
  const rawPathing = getPathingMaskFromTerrainMasks(
    currentMap.tiles,
    currentMap.cliffs,
    newBounds,
  );
  const terrainPathingMap = rawPathing.toReversed();

  const updatedMap = {
    ...currentMap,
    id: `${currentMap.id}-bounds-${Date.now()}`,
    bounds: newBounds,
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
    width: currentMap.width,
    height: currentMap.height,
    bounds: newBounds,
    center: currentMap.center,
  });
};
