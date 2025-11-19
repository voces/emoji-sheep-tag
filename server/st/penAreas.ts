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
