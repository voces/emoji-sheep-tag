import { getPenAreas } from "./penAreas.ts";
import { pathable, pathingMap } from "../systems/pathing.ts";
import { mergeEntityWithPrefab } from "@/shared/api/entity.ts";
import { Entity } from "@/shared/types.ts";
import { getMap } from "@/shared/map.ts";

const MAX_ATTEMPTS = 50;
const MIN_DISTANCE_FROM_PEN = 1;
const MAX_DISTANCE_FROM_PEN = 1.5;
const MIN_DISTANCE_FROM_PEN_EDGE = 0.25;

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

export const getSheepSpawn = (): [x: number, y: number] => {
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

export const getSpiritSpawn = (): [x: number, y: number] => {
  const penAreas = getPenAreas();

  if (penAreas.length === 0) {
    return [0, 0];
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
    ];
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let random = Math.random() * totalArea;
    let selectedArea = penAreas[0];

    for (const area of penAreas) {
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
        break;
      }
      random -= areaSize;
    }

    const [x, y] = getRandomPointInRectangle(
      selectedArea,
      MIN_DISTANCE_FROM_PEN_EDGE,
    );

    if (isPathable(x, y, "spirit")) {
      return [x, y];
    }
  }

  const firstArea = penAreas[0];
  return getRandomPointInRectangle(firstArea, MIN_DISTANCE_FROM_PEN_EDGE);
};
