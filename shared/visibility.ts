// Shared visibility/line-of-sight checking functions
// Used by both client (for per-team visibility) and server (for attack/auto-attack)

// terrainLayers is at 2x resolution relative to world coordinates
export const TERRAIN_SCALE = 2;

// Tilemaps are in pathing tile units (4 per world unit)
const PATHING_SCALE = 4;

// Minimal types for visibility checks - compatible with Entity but not dependent on it
type Position = { x: number; y: number };
type Tilemap = {
  top: number;
  left: number;
  height: number;
  width: number;
  map: ReadonlyArray<number>;
};
type Viewer = {
  position: Position;
  sightRadius?: number;
  id?: string;
  tilemap?: Tilemap;
};
type Target = { position: Position; tilemap?: Tilemap };
type Blocker = {
  position: Position;
  blocksLineOfSight?: number;
  radius?: number;
  id: string;
};

// Helper to get the terrain cell range covered by a tilemap
// Returns { minX, maxX, minY, maxY } in absolute terrain coordinates
const getTilemapTerrainBounds = (
  position: Position,
  tilemap: Tilemap,
): { minX: number; maxX: number; minY: number; maxY: number } => {
  // Convert pathing offsets to world coordinates
  const worldMinX = position.x + tilemap.left / PATHING_SCALE;
  const worldMaxX = position.x + (tilemap.left + tilemap.width) / PATHING_SCALE;
  const worldMinY = position.y + tilemap.top / PATHING_SCALE;
  const worldMaxY = position.y + (tilemap.top + tilemap.height) / PATHING_SCALE;

  // Convert to terrain cells (use floor for min, and floor of (max - epsilon) for max
  // to handle the exclusive upper bound correctly)
  return {
    minX: Math.floor(worldMinX * TERRAIN_SCALE),
    maxX: Math.floor((worldMaxX - 0.001) * TERRAIN_SCALE),
    minY: Math.floor(worldMinY * TERRAIN_SCALE),
    maxY: Math.floor((worldMaxY - 0.001) * TERRAIN_SCALE),
  };
};

// Helper to check if any tilemap cell in a terrain cell is occupied
const hasOccupiedTileInTerrainCell = (
  position: Position,
  tilemap: Tilemap,
  terrainX: number,
  terrainY: number,
): boolean => {
  // Convert terrain cell bounds back to world coords
  const terrainWorldMinX = terrainX / TERRAIN_SCALE;
  const terrainWorldMaxX = (terrainX + 1) / TERRAIN_SCALE;
  const terrainWorldMinY = terrainY / TERRAIN_SCALE;
  const terrainWorldMaxY = (terrainY + 1) / TERRAIN_SCALE;

  // Convert tilemap bounds to world coords
  const tilemapWorldMinX = position.x + tilemap.left / PATHING_SCALE;
  const tilemapWorldMinY = position.y + tilemap.top / PATHING_SCALE;

  // Find which tilemap cells overlap with this terrain cell
  // Tilemap cell (tx, ty) covers world range:
  //   [tilemapWorldMinX + tx/PATHING_SCALE, tilemapWorldMinX + (tx+1)/PATHING_SCALE)
  for (let ty = 0; ty < tilemap.height; ty++) {
    const cellWorldMinY = tilemapWorldMinY + ty / PATHING_SCALE;
    const cellWorldMaxY = tilemapWorldMinY + (ty + 1) / PATHING_SCALE;
    if (
      cellWorldMaxY <= terrainWorldMinY || cellWorldMinY >= terrainWorldMaxY
    ) {
      continue;
    }

    for (let tx = 0; tx < tilemap.width; tx++) {
      const cellWorldMinX = tilemapWorldMinX + tx / PATHING_SCALE;
      const cellWorldMaxX = tilemapWorldMinX + (tx + 1) / PATHING_SCALE;
      if (
        cellWorldMaxX <= terrainWorldMinX || cellWorldMinX >= terrainWorldMaxX
      ) {
        continue;
      }

      if (tilemap.map[ty * tilemap.width + tx] !== 0) {
        return true;
      }
    }
  }
  return false;
};

// Get minimum terrain height for an entity, considering tilemap if present
// Used for targets - visible if ANY part is at or below viewer height
export const getMinEntityHeight = (
  position: Position,
  tilemap: Tilemap | undefined,
  terrainLayers: number[][],
): number => {
  if (tilemap) {
    const bounds = getTilemapTerrainBounds(position, tilemap);

    let minHeight = Infinity;
    for (let terrainY = bounds.minY; terrainY <= bounds.maxY; terrainY++) {
      for (let terrainX = bounds.minX; terrainX <= bounds.maxX; terrainX++) {
        if (
          hasOccupiedTileInTerrainCell(position, tilemap, terrainX, terrainY)
        ) {
          const tileHeight = terrainLayers[terrainY]?.[terrainX] ?? 0;
          if (tileHeight < minHeight) minHeight = tileHeight;
        }
      }
    }
    return minHeight === Infinity ? 0 : minHeight;
  }

  const terrainX = Math.floor(position.x * TERRAIN_SCALE);
  const terrainY = Math.floor(position.y * TERRAIN_SCALE);
  return terrainLayers[terrainY]?.[terrainX] ?? 0;
};

// Find the world position of the closest tile at the minimum height level
// Returns the center of that tile in world coordinates
// If no tilemap or tilemap has no tiles, returns the entity position
export const getClosestMinHeightPoint = (
  position: Position,
  tilemap: Tilemap | undefined,
  terrainLayers: number[][],
  viewerPosition: Position,
): Position => {
  if (!tilemap) return position;

  const bounds = getTilemapTerrainBounds(position, tilemap);

  // First pass: find the minimum height
  let minHeight = Infinity;
  for (let terrainY = bounds.minY; terrainY <= bounds.maxY; terrainY++) {
    for (let terrainX = bounds.minX; terrainX <= bounds.maxX; terrainX++) {
      if (hasOccupiedTileInTerrainCell(position, tilemap, terrainX, terrainY)) {
        const tileHeight = terrainLayers[terrainY]?.[terrainX] ?? 0;
        if (tileHeight < minHeight) minHeight = tileHeight;
      }
    }
  }

  if (minHeight === Infinity) return position;

  // Second pass: find the closest tile at minimum height
  let closestDistSq = Infinity;
  let closestX = position.x;
  let closestY = position.y;

  for (let terrainY = bounds.minY; terrainY <= bounds.maxY; terrainY++) {
    for (let terrainX = bounds.minX; terrainX <= bounds.maxX; terrainX++) {
      if (hasOccupiedTileInTerrainCell(position, tilemap, terrainX, terrainY)) {
        const tileHeight = terrainLayers[terrainY]?.[terrainX] ?? 0;
        if (tileHeight === minHeight) {
          // Convert terrain coords back to world coords (center of tile)
          const worldX = (terrainX + 0.5) / TERRAIN_SCALE;
          const worldY = (terrainY + 0.5) / TERRAIN_SCALE;
          const dx = worldX - viewerPosition.x;
          const dy = worldY - viewerPosition.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            closestX = worldX;
            closestY = worldY;
          }
        }
      }
    }
  }

  return { x: closestX, y: closestY };
};

// Get maximum terrain height for an entity, considering tilemap if present
// Used for viewers - can see from their highest point
export const getMaxEntityHeight = (
  position: Position,
  tilemap: Tilemap | undefined,
  terrainLayers: number[][],
): number => {
  if (tilemap) {
    const bounds = getTilemapTerrainBounds(position, tilemap);

    let maxHeight = -Infinity;
    for (let terrainY = bounds.minY; terrainY <= bounds.maxY; terrainY++) {
      for (let terrainX = bounds.minX; terrainX <= bounds.maxX; terrainX++) {
        if (
          hasOccupiedTileInTerrainCell(position, tilemap, terrainX, terrainY)
        ) {
          const tileHeight = terrainLayers[terrainY]?.[terrainX] ?? 0;
          if (tileHeight > maxHeight) maxHeight = tileHeight;
        }
      }
    }
    return maxHeight === -Infinity ? 0 : maxHeight;
  }

  const terrainX = Math.floor(position.x * TERRAIN_SCALE);
  const terrainY = Math.floor(position.y * TERRAIN_SCALE);
  return terrainLayers[terrainY]?.[terrainX] ?? 0;
};

// DDA grid traversal: returns true if line of sight is blocked by terrain
export const raycastBlocked = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  viewerHeight: number,
  terrainLayers: number[][],
): boolean => {
  // Scale to terrain grid coordinates
  const startX = x0 * TERRAIN_SCALE;
  const startY = y0 * TERRAIN_SCALE;
  const endX = x1 * TERRAIN_SCALE;
  const endY = y1 * TERRAIN_SCALE;

  // Current grid cell
  let cellX = Math.floor(startX);
  let cellY = Math.floor(startY);

  // Target grid cell
  const targetCellX = Math.floor(endX);
  const targetCellY = Math.floor(endY);

  // Same cell - no traversal needed
  if (cellX === targetCellX && cellY === targetCellY) return false;

  const dx = endX - startX;
  const dy = endY - startY;

  // Direction of ray (+1 or -1, or 0 if no movement on that axis)
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  // Distance along ray to cross one cell in each direction
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;

  // Distance to first cell boundary
  let tX = stepX !== 0
    ? (stepX > 0 ? (cellX + 1 - startX) : (startX - cellX)) * tDeltaX
    : Infinity;
  let tY = stepY !== 0
    ? (stepY > 0 ? (cellY + 1 - startY) : (startY - cellY)) * tDeltaY
    : Infinity;

  // Safety limit based on Manhattan distance
  const maxSteps = Math.abs(targetCellX - cellX) +
    Math.abs(targetCellY - cellY) + 1;

  // Traverse grid cells along the ray
  for (let step = 0; step < maxSteps; step++) {
    // Move to next cell first
    if (tX < tY) {
      cellX += stepX;
      tX += tDeltaX;
    } else {
      cellY += stepY;
      tY += tDeltaY;
    }

    // Check if we've reached target
    if (cellX === targetCellX && cellY === targetCellY) break;

    // Check current cell
    const height = terrainLayers[cellY]?.[cellX] ?? 0;
    if (height > viewerHeight) return true;
  }

  return false;
};

// Check if a viewer can see a target position
// getBlockersInRange is a callback to allow different spatial query implementations
export const canSeeTarget = (
  viewer: Viewer,
  target: Target,
  terrainLayers: number[][],
  getBlockersInRange: (x: number, y: number, radius: number) => Blocker[],
): boolean => {
  if (!viewer.position || !target.position) return false;

  const viewerX = viewer.position.x;
  const viewerY = viewer.position.y;

  // Get viewer's terrain height (use max for tilemaps - can see from highest point)
  const viewerHeight = getMaxEntityHeight(
    viewer.position,
    viewer.tilemap,
    terrainLayers,
  );

  // Get target's terrain height - can't see targets higher than viewer
  // For entities with tilemaps, check the minimum height across all occupied tiles
  const targetHeight = getMinEntityHeight(
    target.position,
    target.tilemap,
    terrainLayers,
  );
  if (targetHeight > viewerHeight) return false;

  // For tilemapped targets, raycast to the closest tile at the minimum height level
  // This handles structures spanning cliff boundaries correctly
  const raycastTarget = getClosestMinHeightPoint(
    target.position,
    target.tilemap,
    terrainLayers,
    viewer.position,
  );
  const targetX = raycastTarget.x;
  const targetY = raycastTarget.y;

  const dx = targetX - viewerX;
  const dy = targetY - viewerY;
  const distSq = dx * dx + dy * dy;

  // Check sight radius if specified (use original target position for radius check)
  if (viewer.sightRadius !== undefined) {
    const origDx = target.position.x - viewerX;
    const origDy = target.position.y - viewerY;
    const origDistSq = origDx * origDx + origDy * origDy;
    const radiusSq = viewer.sightRadius * viewer.sightRadius;
    if (origDistSq > radiusSq) return false;
  }

  // Check line of sight through terrain
  if (
    raycastBlocked(
      viewerX,
      viewerY,
      targetX,
      targetY,
      viewerHeight,
      terrainLayers,
    )
  ) {
    return false;
  }

  // Skip blocker checks for very short distances
  if (distSq < 1) return true;

  // Check for entity blockers along the ray
  const dist = Math.sqrt(distSq);
  const midX = (viewerX + targetX) / 2;
  const midY = (viewerY + targetY) / 2;
  const blockers = getBlockersInRange(midX, midY, dist / 2 + 1);

  for (const blocker of blockers) {
    if (!blocker.blocksLineOfSight || !blocker.position) continue;
    if (viewer.id && blocker.id === viewer.id) continue;

    const bx = blocker.position.x;
    const by = blocker.position.y;

    const t = ((bx - viewerX) * dx + (by - viewerY) * dy) / distSq;

    // Skip if blocker is not between viewer and target
    if (t <= 0 || t >= 1) continue;

    // Find closest point on line to blocker
    const closestX = viewerX + t * dx;
    const closestY = viewerY + t * dy;
    const blockerDistSq = (bx - closestX) ** 2 + (by - closestY) ** 2;

    // Blocker blocks if close enough to the line (use squared distance)
    const blockerRadius = blocker.radius ?? 0.5;
    if (blockerDistSq < blockerRadius * blockerRadius) {
      const blockerTerrainX = Math.floor(bx * TERRAIN_SCALE);
      const blockerTerrainY = Math.floor(by * TERRAIN_SCALE);
      const blockerTerrainHeight =
        terrainLayers[blockerTerrainY]?.[blockerTerrainX] ?? 0;
      const heightDiff = Math.abs(blockerTerrainHeight - viewerHeight);

      if (heightDiff < blocker.blocksLineOfSight) {
        return false;
      }
    }
  }

  return true;
};
