export type Cell = [number, number];

/**
 * Returns cells covered by a brush centered on (centerX, centerY). Size 1 is a
 * single cell; sizes 2-5 expand the brush radius (radius = size - 1). For
 * circles the inclusion test uses (radius + 0.5)^2 so small radii produce
 * recognisable disc shapes rather than narrow plus signs.
 */
export const getBrushCells = (
  centerX: number,
  centerY: number,
  size: 1 | 2 | 3 | 4 | 5,
  shape: "circle" | "square",
  width: number,
  height: number,
): Cell[] => {
  const radius = size - 1;
  const cells: Cell[] = [];
  if (radius === 0) {
    if (centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
      cells.push([centerX, centerY]);
    }
    return cells;
  }
  const limitSquared = (radius + 0.5) * (radius + 0.5);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (shape === "circle" && dx * dx + dy * dy > limitSquared) continue;
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      cells.push([x, y]);
    }
  }
  return cells;
};

/**
 * 4-connected flood fill that returns every cell reachable from (startX,
 * startY) whose value (per `getValue`) matches the start cell's value.
 */
export const getFloodFillCells = <T>(
  startX: number,
  startY: number,
  width: number,
  height: number,
  getValue: (x: number, y: number) => T,
): Cell[] => {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return [];
  }
  const sourceValue = getValue(startX, startY);
  const visited = new Uint8Array(width * height);
  const cells: Cell[] = [];
  const stack: number[] = [startX, startY];
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (getValue(x, y) !== sourceValue) continue;
    cells.push([x, y]);
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return cells;
};

/** Every cell on the map. */
export const getAllCells = (width: number, height: number): Cell[] => {
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) cells.push([x, y]);
  }
  return cells;
};
