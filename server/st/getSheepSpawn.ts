import { getEndAreas, getPenAreas, getStartAreas } from "@/shared/penAreas.ts";
import { pathable, pathingMap } from "../systems/pathing.ts";
import { mergeEntityWithPrefab } from "@/shared/api/entity.ts";
import { Entity } from "@/shared/types.ts";
import { getMap, getMapCenter } from "@/shared/map.ts";
import { lobbyContext } from "../contexts.ts";
import { newUnit } from "../api/unit.ts";
import { START_TILE } from "@/shared/maps/tags.ts";

const MAX_ATTEMPTS = 50;
const MIN_DISTANCE_FROM_PEN = 1;
const MAX_DISTANCE_FROM_PEN = 1.5;
const MIN_DISTANCE_FROM_PEN_EDGE = 0.25;

type Rect = { x: number; y: number; width: number; height: number };

const isInRect = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.width &&
  y >= rect.y && y <= rect.y + rect.height;

const clampToRect = (
  rect: Rect,
  x: number,
  y: number,
): { x: number; y: number } => ({
  x: Math.max(rect.x, Math.min(rect.x + rect.width, x)),
  y: Math.max(rect.y, Math.min(rect.y + rect.height, y)),
});

const startTileCellsCache = new WeakMap<object, Rect[]>();

/** Returns each START tile as a unit-square rect in world coords. */
const getStartTileCells = (): Rect[] => {
  const map = getMap();
  const cached = startTileCellsCache.get(map);
  if (cached) return cached;
  const cells: Rect[] = [];
  const h = map.tiles.length;
  for (let ty = 0; ty < h; ty++) {
    const row = map.tiles[ty];
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] === START_TILE) {
        cells.push({ x: tx, y: h - 1 - ty, width: 1, height: 1 });
      }
    }
  }
  startTileCellsCache.set(map, cells);
  return cells;
};

const expandedPenRects = (): Rect[] =>
  getPenAreas().map((p) => ({
    x: p.x - MAX_DISTANCE_FROM_PEN,
    y: p.y - MAX_DISTANCE_FROM_PEN,
    width: p.width + MAX_DISTANCE_FROM_PEN * 2,
    height: p.height + MAX_DISTANCE_FROM_PEN * 2,
  }));

/** Rectangles that bound the sheep spawn area for the current mode. */
const getSpawnAreaRects = (): Rect[] => {
  if (lobbyContext.current?.settings.mode === "bulldog") {
    return getStartTileCells();
  }
  return expandedPenRects();
};

const closestPointOnRects = (
  rects: Rect[],
  x: number,
  y: number,
): { x: number; y: number } => {
  let best = clampToRect(rects[0], x, y);
  let bestDist = (best.x - x) ** 2 + (best.y - y) ** 2;
  for (let i = 1; i < rects.length; i++) {
    const candidate = clampToRect(rects[i], x, y);
    const dist = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
};

/** Push a point out of the nearest pen interior by MIN_DISTANCE_FROM_PEN. */
const pushOutOfPenInteriors = (
  x: number,
  y: number,
): { x: number; y: number } => {
  const pens = getPenAreas();
  for (const pen of pens) {
    if (
      x > pen.x && x < pen.x + pen.width &&
      y > pen.y && y < pen.y + pen.height
    ) {
      // Find which edge to push to, choose the closest
      const distLeft = x - pen.x;
      const distRight = pen.x + pen.width - x;
      const distBottom = y - pen.y;
      const distTop = pen.y + pen.height - y;
      const minDist = Math.min(distLeft, distRight, distBottom, distTop);
      if (minDist === distLeft) return { x: pen.x - MIN_DISTANCE_FROM_PEN, y };
      if (minDist === distRight) {
        return { x: pen.x + pen.width + MIN_DISTANCE_FROM_PEN, y };
      }
      if (minDist === distBottom) {
        return { x, y: pen.y - MIN_DISTANCE_FROM_PEN };
      }
      return { x, y: pen.y + pen.height + MIN_DISTANCE_FROM_PEN };
    }
  }
  return { x, y };
};

/** True when the point is inside any valid sheep spawn area for the current mode. */
export const isInSheepSpawnArea = (x: number, y: number): boolean => {
  const rects = getSpawnAreaRects();
  if (rects.length === 0) {
    return lobbyContext.current?.settings.mode !== "bulldog";
  }
  if (!rects.some((r) => isInRect(r, x, y))) return false;
  // For survival, the inner pen interior is also excluded.
  if (lobbyContext.current?.settings.mode !== "bulldog") {
    return getPenAreas().every((pen) =>
      x <= pen.x || x >= pen.x + pen.width ||
      y <= pen.y || y >= pen.y + pen.height
    );
  }
  return true;
};

/** Clamp a point to the nearest valid sheep spawn area for the current mode. */
export const clampToSheepSpawnArea = (
  x: number,
  y: number,
): { x: number; y: number } => {
  const rects = getSpawnAreaRects();
  if (rects.length === 0) return { x, y };

  // Step 1: clamp into the outer area.
  const clamped = closestPointOnRects(rects, x, y);

  // Step 2 (survival only): push out of the inner pen interior so the result lies in the strip.
  if (lobbyContext.current?.settings.mode === "bulldog") return clamped;
  return pushOutOfPenInteriors(clamped.x, clamped.y);
};

const isPathable = (x: number, y: number, prefab: string): boolean => {
  const testEntity = mergeEntityWithPrefab({
    prefab,
    position: { x, y },
  });
  return pathable(testEntity as Entity, { x, y });
};

const getDistanceToPenTiles = (x: number, y: number): number => {
  const map = getMap();
  const pm = pathingMap();

  const tileX = pm.xWorldToTile(x);
  const tileY = pm.yWorldToTile(y);

  let minDistance = Infinity;

  const searchRadius = Math.ceil(MAX_DISTANCE_FROM_PEN * pm.resolution) + 1;

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const checkTileX = tileX + dx;
      const checkTileY = tileY + dy;

      if (
        checkTileY >= 0 &&
        checkTileY < pm.heightMap &&
        checkTileX >= 0 &&
        checkTileX < pm.widthMap
      ) {
        const checkWorldX = pm.xTileToWorld(checkTileX);
        const checkWorldY = pm.yTileToWorld(checkTileY);

        const checkArrayY = map.tiles.length - Math.floor(checkWorldY) - 1;
        const checkArrayX = Math.floor(checkWorldX);

        if (
          checkArrayY >= 0 &&
          checkArrayY < map.tiles.length &&
          checkArrayX >= 0 &&
          checkArrayX < map.tiles[0].length &&
          map.tiles[checkArrayY][checkArrayX] === 1
        ) {
          const tileCenterX = checkWorldX + 0.5 / pm.resolution;
          const tileCenterY = checkWorldY + 0.5 / pm.resolution;
          const dist = Math.sqrt(
            (x - tileCenterX) ** 2 + (y - tileCenterY) ** 2,
          );
          minDistance = Math.min(minDistance, dist);
        }
      }
    }
  }

  return minDistance;
};

const isValidSheepSpawn = (x: number, y: number): boolean => {
  const distance = getDistanceToPenTiles(x, y);
  return distance >= MIN_DISTANCE_FROM_PEN && distance <= MAX_DISTANCE_FROM_PEN;
};

const getRandomPointAroundRectangle = (
  rect: { x: number; y: number; width: number; height: number },
  minDistance: number,
  maxDistance: number,
): [x: number, y: number] => {
  const side = Math.floor(Math.random() * 4);
  const distance = minDistance + Math.random() * (maxDistance - minDistance);

  switch (side) {
    case 0: {
      const x = rect.x + Math.random() * rect.width;
      const y = rect.y - distance;
      return [x, y];
    }
    case 1: {
      const x = rect.x + rect.width + distance;
      const y = rect.y + Math.random() * rect.height;
      return [x, y];
    }
    case 2: {
      const x = rect.x + Math.random() * rect.width;
      const y = rect.y + rect.height + distance;
      return [x, y];
    }
    default: {
      const x = rect.x - distance;
      const y = rect.y + Math.random() * rect.height;
      return [x, y];
    }
  }
};

const getRandomPointInRectangle = (
  rect: { x: number; y: number; width: number; height: number },
  edgeBuffer: number,
): [x: number, y: number] => {
  const x = rect.x +
    edgeBuffer +
    Math.random() * Math.max(0, rect.width - 2 * edgeBuffer);
  const y = rect.y +
    edgeBuffer +
    Math.random() * Math.max(0, rect.height - 2 * edgeBuffer);
  return [x, y];
};

const getBulldogSheepSpawn = (): [x: number, y: number] | null => {
  const startAreas = getStartAreas();
  if (startAreas.length === 0) return null;

  const totalArea = startAreas.reduce(
    (sum, area) => sum + area.width * area.height,
    0,
  );

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let random = Math.random() * totalArea;
    let selectedArea = startAreas[0];

    for (const area of startAreas) {
      const areaSize = area.width * area.height;
      if (random < areaSize) {
        selectedArea = area;
        break;
      }
      random -= areaSize;
    }

    const [x, y] = getRandomPointInRectangle(
      selectedArea,
      MIN_DISTANCE_FROM_PEN_EDGE,
    );

    if (isPathable(x, y, "sheep")) return [x, y];
  }

  const fallback = startAreas[0];
  return [
    fallback.x + fallback.width / 2,
    fallback.y + fallback.height / 2,
  ];
};

export const spawnSheepAt = (
  ownerId: string,
  x: number,
  y: number,
  extra?: Partial<Entity>,
): Entity => {
  const facing = getSheepSpawnFacing(x, y);
  return newUnit(ownerId, "sheep", x, y, {
    ...(facing != null ? { facing } : {}),
    ...extra,
  });
};

export const spawnSheep = (
  ownerId: string,
  extra?: Partial<Entity>,
): Entity => {
  const [x, y] = getSheepSpawn();
  return spawnSheepAt(ownerId, x, y, extra);
};

export const getSheepSpawnFacing = (
  x: number,
  y: number,
): number | undefined => {
  if (lobbyContext.current?.settings.mode !== "bulldog") return undefined;

  const endAreas = getEndAreas();
  if (endAreas.length === 0) return undefined;

  let nearest = endAreas[0];
  let nearestDistSq = Infinity;
  for (const area of endAreas) {
    const cx = area.x + area.width / 2;
    const cy = area.y + area.height / 2;
    const distSq = (cx - x) ** 2 + (cy - y) ** 2;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = area;
    }
  }

  const targetX = nearest.x + nearest.width / 2;
  const targetY = nearest.y + nearest.height / 2;
  return Math.atan2(targetY - y, targetX - x);
};

export const getSheepSpawn = (): [x: number, y: number] => {
  const lobby = lobbyContext.current;
  if (lobby?.settings.mode === "bulldog") {
    const spawn = getBulldogSheepSpawn();
    if (spawn) return spawn;
  }

  const penAreas = getPenAreas();

  if (penAreas.length === 0) return [0, 0];

  const totalArea = penAreas.reduce(
    (sum, area) => sum + area.width * area.height,
    0,
  );

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let random = Math.random() * totalArea;
    let selectedArea = penAreas[0];

    for (const area of penAreas) {
      const areaSize = area.width * area.height;
      if (random < areaSize) {
        selectedArea = area;
        break;
      }
      random -= areaSize;
    }

    const [x, y] = getRandomPointInRectangle(
      selectedArea,
      -MAX_DISTANCE_FROM_PEN,
    );

    if (isValidSheepSpawn(x, y) && isPathable(x, y, "sheep")) return [x, y];
  }

  return getRandomPointAroundRectangle(
    penAreas[0],
    MIN_DISTANCE_FROM_PEN,
    MAX_DISTANCE_FROM_PEN,
  );
};

export const getSpiritSpawn = (): [
  x: number,
  y: number,
  penAreaIndex: number,
] => {
  const penAreas = getPenAreas();

  if (penAreas.length === 0) {
    // No pen on this map (e.g. bulldog-only): fall back to the wolf spawn
    // point at map center.
    const { x, y } = getMapCenter();
    return [x, y, -1];
  }

  const totalArea = penAreas.reduce((sum, area) => {
    const usableWidth = Math.max(
      0,
      area.width - 2 * MIN_DISTANCE_FROM_PEN_EDGE,
    );
    const usableHeight = Math.max(
      0,
      area.height - 2 * MIN_DISTANCE_FROM_PEN_EDGE,
    );
    return sum + usableWidth * usableHeight;
  }, 0);

  if (totalArea === 0) {
    const firstArea = penAreas[0];
    return [
      firstArea.x + firstArea.width / 2,
      firstArea.y + firstArea.height / 2,
      0,
    ];
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let random = Math.random() * totalArea;
    let selectedArea = penAreas[0];
    let selectedIndex = 0;

    for (let i = 0; i < penAreas.length; i++) {
      const area = penAreas[i];
      const usableWidth = Math.max(
        0,
        area.width - 2 * MIN_DISTANCE_FROM_PEN_EDGE,
      );
      const usableHeight = Math.max(
        0,
        area.height - 2 * MIN_DISTANCE_FROM_PEN_EDGE,
      );
      const areaSize = usableWidth * usableHeight;

      if (random < areaSize) {
        selectedArea = area;
        selectedIndex = i;
        break;
      }
      random -= areaSize;
    }

    const [x, y] = getRandomPointInRectangle(
      selectedArea,
      MIN_DISTANCE_FROM_PEN_EDGE,
    );

    if (isPathable(x, y, "spirit")) {
      return [x, y, selectedIndex];
    }
  }

  const firstArea = penAreas[0];
  const [x, y] = getRandomPointInRectangle(
    firstArea,
    MIN_DISTANCE_FROM_PEN_EDGE,
  );
  return [x, y, 0];
};
