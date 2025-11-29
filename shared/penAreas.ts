import { getMap, onMapChange } from "@/shared/map.ts";

type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PEN_TILE_INDEX = 1;

let cachedPenAreas: Rectangle[] | null = null;
let cachedMapId: string | null = null;

onMapChange(() => {
  cachedPenAreas = null;
  cachedMapId = null;
});

export const getPenAreas = (): Rectangle[] => {
  const map = getMap();

  if (cachedMapId === map.id && cachedPenAreas) {
    return cachedPenAreas;
  }

  const visited = Array.from(
    { length: map.tiles.length },
    () => Array(map.tiles[0].length).fill(false),
  );

  const areas: Rectangle[] = [];

  for (let y = 0; y < map.tiles.length; y++) {
    for (let x = 0; x < map.tiles[y].length; x++) {
      if (map.tiles[y][x] === PEN_TILE_INDEX && !visited[y][x]) {
        const area = findPenArea(map.tiles, visited, x, y);
        if (area) {
          areas.push(area);
        }
      }
    }
  }

  cachedMapId = map.id;
  cachedPenAreas = areas;

  return areas;
};

const findPenArea = (
  tiles: number[][],
  visited: boolean[][],
  startX: number,
  startY: number,
): Rectangle | null => {
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  visited[startY][startX] = true;

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.y >= 0 &&
        neighbor.y < tiles.length &&
        neighbor.x >= 0 &&
        neighbor.x < tiles[neighbor.y].length &&
        tiles[neighbor.y][neighbor.x] === PEN_TILE_INDEX &&
        !visited[neighbor.y][neighbor.x]
      ) {
        visited[neighbor.y][neighbor.x] = true;
        queue.push(neighbor);
      }
    }
  }

  const mapHeight = tiles.length;

  return {
    x: minX,
    y: mapHeight - maxY - 1,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

export const clearPenAreasCache = () => {
  cachedPenAreas = null;
  cachedMapId = null;
};

// Returns a multiplier for gold generation based on distance from pen
// 2.5 inside pen, 1.5 just outside, down to 0.25 at map edge
export const getDistanceMultiplier = (x: number, y: number): number => {
  const map = getMap();
  const pens = getPenAreas();
  const bounds = map.bounds;

  // Check if inside any pen
  for (const pen of pens) {
    if (
      x >= pen.x &&
      x < pen.x + pen.width &&
      y >= pen.y &&
      y < pen.y + pen.height
    ) return 2.5;
  }

  // If no pens exist, return 1 (no penalty)
  if (pens.length === 0) return 1;

  // Find closest pen edge (clamped point on pen boundary)
  let minDelta = Infinity;

  for (const pen of pens) {
    const penMinX = pen.x;
    const penMaxX = pen.x + pen.width;
    const penMinY = pen.y;
    const penMaxY = pen.y + pen.height;

    // Calculate delta for each axis (0 to 1, where 1 is at pen edge, 0 is at map edge)
    let xDelta = 1;
    let yDelta = 1;

    if (x < penMinX) {
      // Left of pen
      xDelta = (x - bounds.min.x) / (penMinX - bounds.min.x);
    } else if (x > penMaxX) {
      // Right of pen
      xDelta = (bounds.max.x - x) / (bounds.max.x - penMaxX);
    }

    if (y < penMinY) {
      // Below pen
      yDelta = (y - bounds.min.y) / (penMinY - bounds.min.y);
    } else if (y > penMaxY) {
      // Above pen
      yDelta = (bounds.max.y - y) / (bounds.max.y - penMaxY);
    }

    // Use minimum of x and y deltas (worst axis determines penalty)
    const delta = Math.min(xDelta, yDelta);
    minDelta = Math.min(minDelta, 1 - delta); // Track closest pen (smallest distance)
  }

  // Convert back: minDelta is distance from closest pen (0 = at pen, 1 = at edge)
  const closestDelta = 1 - minDelta;

  // Clamp to valid range
  const clampedDelta = Math.max(0, Math.min(1, closestDelta));

  // Exponential drop off: tween between 0.25 and 1.5
  return clampedDelta ** 2 * 1.25 + 0.25;
};
