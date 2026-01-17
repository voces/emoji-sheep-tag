import { addSystem } from "@/shared/context.ts";
import { getPenAreas } from "@/shared/penAreas.ts";
import { getMap } from "@/shared/map.ts";

// Offset from spirit position to check for pen tile in each cardinal direction
const CHECK_OFFSET = 0.375;

// Check if a world position is on a pen tile
const isPenTile = (x: number, y: number): boolean => {
  const map = getMap();
  const tileX = Math.floor(x);
  const tileY = map.tiles.length - Math.floor(y) - 1;

  if (tileY < 0 || tileY >= map.tiles.length) return false;
  if (tileX < 0 || tileX >= map.tiles[0].length) return false;

  return map.tiles[tileY][tileX] === 1; // 1 is pen tile index
};

// Check if spirit has left the pen by checking cardinal directions
const hasLeftPen = (x: number, y: number): boolean => {
  const offsets = [
    { dx: CHECK_OFFSET, dy: 0 },
    { dx: -CHECK_OFFSET, dy: 0 },
    { dx: 0, dy: CHECK_OFFSET },
    { dx: 0, dy: -CHECK_OFFSET },
  ];

  for (const { dx, dy } of offsets) {
    if (!isPenTile(x + dx, y + dy)) return true;
  }
  return false;
};

addSystem({
  props: ["position", "penAreaIndex"],
  updateEntity: (entity) => {
    if (entity.penAreaIndex < 0) return;

    const { x, y } = entity.position;

    if (!hasLeftPen(x, y)) return;

    const penAreas = getPenAreas();
    const penArea = penAreas[entity.penAreaIndex];

    if (penArea) {
      // Teleport to center of their pen area
      entity.position = {
        x: penArea.x + penArea.width / 2,
        y: penArea.y + penArea.height / 2,
      };
    }
  },
});
