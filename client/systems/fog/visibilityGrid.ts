import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from "three";
import type { Entity } from "../../ecs.ts";
import type { getMapBounds, getTerrainLayers } from "@/shared/map.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import { getMaxEntityHeight } from "@/shared/visibility.ts";
import { computeUnitSightRadius } from "@/shared/api/unit.ts";

// Fog resolution multiplier: 2 = 160x160, 4 = 320x320, etc.
export const FOG_RESOLUTION_MULTIPLIER = 4;

type Cell = {
  visibleCount: number;
  isVisible: boolean; // Cache for visibleCount > 0
  x: number;
  y: number;
};

// Entities by fog grid cell (y -> x -> entities). Plain object (not Map) so
// the hot getEntitiesNeedingUpdate path can use integer-key element access.
export type EntityGridMap = Record<number, Map<number, Set<Entity>>>;

export type VisibilityGridSources = {
  entityGridMap: EntityGridMap;
  fogBounds: ReturnType<typeof getMapBounds>;
  terrainLayerData: ReturnType<typeof getTerrainLayers>;
};

export class VisibilityGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly cells: Cell[][];
  private readonly entityToViewshed: Map<Entity, number[]> = new Map();
  private readonly entityLastPos: Map<
    Entity,
    { x: number; y: number; r: number }
  > = new Map();
  readonly fogTexture: DataTexture;
  private readonly fogData: Uint8Array;
  readonly modifiedCells: Set<number> = new Set(); // Cells whose isVisible transitioned this update
  private readonly bfsVisited: Uint8Array;
  private readonly bfsBlocked: Uint8Array;
  private readonly bfsQueueX: Int32Array;
  private readonly bfsQueueY: Int32Array;
  private readonly bfsOldMark: Uint8Array;
  private readonly bfsNewMark: Uint8Array;
  private readonly entityGridMap: EntityGridMap;
  private readonly fogBounds: VisibilityGridSources["fogBounds"];
  private readonly terrainLayerData: VisibilityGridSources["terrainLayerData"];

  constructor(
    width: number,
    height: number,
    { entityGridMap, fogBounds, terrainLayerData }: VisibilityGridSources,
  ) {
    this.width = width;
    this.height = height;
    this.entityGridMap = entityGridMap;
    this.fogBounds = fogBounds;
    this.terrainLayerData = terrainLayerData;
    this.cells = Array.from(
      { length: height },
      (_, y) =>
        Array.from({ length: width }, (_, x) => ({
          visibleCount: 0,
          isVisible: false,
          x,
          y,
        })),
    );

    this.fogData = new Uint8Array(width * height);
    this.bfsVisited = new Uint8Array(width * height);
    this.bfsBlocked = new Uint8Array(width * height);
    this.bfsQueueX = new Int32Array(width * height);
    this.bfsQueueY = new Int32Array(width * height);
    this.bfsOldMark = new Uint8Array(width * height);
    this.bfsNewMark = new Uint8Array(width * height);

    this.fogTexture = new DataTexture(
      this.fogData,
      width,
      height,
      RedFormat,
      UnsignedByteType,
    );
    this.fogTexture.wrapS = this.fogTexture.wrapT = ClampToEdgeWrapping;
    this.fogTexture.minFilter = LinearFilter;
    this.fogTexture.magFilter = LinearFilter;
    this.fogTexture.needsUpdate = true;
  }

  updateEntity(entity: Entity) {
    if (!entity.sightRadius || !entity.position) return;

    const effectiveSightRadius = computeUnitSightRadius(entity);
    const cx = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
    const cy = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);
    const r = Math.ceil(effectiveSightRadius * FOG_RESOLUTION_MULTIPLIER);

    // Short-circuit if entity hasn't moved and sight radius hasn't changed
    const lastPos = this.entityLastPos.get(entity);
    if (lastPos && lastPos.x === cx && lastPos.y === cy && lastPos.r === r) {
      return;
    }
    this.entityLastPos.set(entity, { x: cx, y: cy, r });

    const oldViewshed = this.entityToViewshed.get(entity);
    const oldMark = this.bfsOldMark;
    const newMark = this.bfsNewMark;
    if (oldViewshed) {
      for (let i = 0; i < oldViewshed.length; i++) {
        oldMark[oldViewshed[i]] = 1;
      }
    }
    const newViewshed: number[] = [];

    // terrainLayers is 2x resolution; fog grid is 4x
    const terrainScale = FOG_RESOLUTION_MULTIPLIER / 2;

    // Get entity's height level - use max across tilemap so buildings on cliff
    // edges can see from their highest point (matches canSeeTarget behavior)
    const entityHeight = getMaxEntityHeight(
      entity.position,
      entity.tilemap,
      this.terrainLayerData,
    );

    // Build a grid of blocker coverage within sight radius
    // Use Map<number, Set<number>> for faster lookups (avoid string concat)
    // Also store which blocker is at each cell for fast lookup
    const blockerGrid = new Map<number, Set<number>>();
    const blockerAtCell = new Map<number, Map<number, Entity>>(); // y -> x -> blocker

    // Use KDTree to get blockers in range
    const searchRadius = (r / FOG_RESOLUTION_MULTIPLIER) + 2; // +2 for safety margin
    const nearbyEntities = getEntitiesInRange(
      entity.position.x,
      entity.position.y,
      searchRadius,
    );

    for (const blocker of nearbyEntities) {
      if (!blocker.blocksLineOfSight || !blocker.position) continue;
      const bx = Math.floor(blocker.position.x * FOG_RESOLUTION_MULTIPLIER);
      const by = Math.floor(blocker.position.y * FOG_RESOLUTION_MULTIPLIER);

      // Skip if blocker is outside sight radius
      if (Math.abs(bx - cx) > r || Math.abs(by - cy) > r) continue;

      // Use tilemap if available
      const tilemap = blocker.tilemap;
      if (tilemap) {
        // Tilemap coordinates are in 2x resolution (same as fog grid)
        const startY = by + tilemap.top;
        const startX = bx + tilemap.left;

        let i = 0;
        // Note: tile maps may be upside down, iterate from top to bottom
        for (let ty = 0; ty < tilemap.height; ty++) {
          for (let tx = 0; tx < tilemap.width; tx++, i++) {
            if (tilemap.map[i] !== 0) {
              const fogY = startY + ty;
              const fogX = startX + tx;
              if (!blockerGrid.has(fogY)) blockerGrid.set(fogY, new Set());
              blockerGrid.get(fogY)!.add(fogX);
              if (!blockerAtCell.has(fogY)) blockerAtCell.set(fogY, new Map());
              blockerAtCell.get(fogY)!.set(fogX, blocker);
            }
          }
        }
      } else {
        // No tilemap, just block the cell the entity is in
        if (!blockerGrid.has(by)) blockerGrid.set(by, new Set());
        blockerGrid.get(by)!.add(bx);
        if (!blockerAtCell.has(by)) blockerAtCell.set(by, new Map());
        blockerAtCell.get(by)!.set(bx, blocker);
      }
    }

    const fogBounds = this.fogBounds;

    // Use flood fill with shadow casting for blockers and cliffs
    const radiusSquared = (effectiveSightRadius * FOG_RESOLUTION_MULTIPLIER) **
      2;
    const width = this.width;
    const visited = this.bfsVisited;
    const blocked = this.bfsBlocked;
    visited.fill(0);
    blocked.fill(0);
    const queueX = this.bfsQueueX;
    const queueY = this.bfsQueueY;
    queueX[0] = cx;
    queueY[0] = cy;
    let queueHead = 0;
    let queueTail = 1;

    visited[cy * width + cx] = 1;

    while (queueHead < queueTail) {
      const x = queueX[queueHead];
      const y = queueY[queueHead];
      queueHead++;

      // Skip if this cell is in a shadow
      if (blocked[y * width + x]) continue;

      // Check distance
      const dx = x - cx;
      const dy = y - cy;
      const distSquared = dx * dx + dy * dy;
      if (distSquared > radiusSquared) continue;

      // Check bounds - treat out of bounds as blocked (bounds are in world coordinates)
      const worldX = x / FOG_RESOLUTION_MULTIPLIER;
      const worldY = y / FOG_RESOLUTION_MULTIPLIER;
      if (
        worldX < fogBounds.min.x || worldX >= fogBounds.max.x ||
        worldY < fogBounds.min.y || worldY >= fogBounds.max.y
      ) continue;

      // Check height blocking (terrainLayers is 2x resolution)
      const terrainX = Math.floor(x / terrainScale);
      const terrainY = Math.floor(y / terrainScale);
      const terrainRow = this.terrainLayerData[terrainY];
      const height = terrainRow?.[terrainX] ?? 0;

      if (height > entityHeight) {
        // Cliff blocks - cast shadow behind it
        const dist = Math.sqrt(distSquared);
        if (dist > 0.1) {
          const normalX = dx / dist;
          const normalY = dy / dist;

          // Cast shadow from this cliff cell
          const shadowLength = Math.ceil(
            effectiveSightRadius * FOG_RESOLUTION_MULTIPLIER,
          );

          // Perpendicular vector for cone width
          const perpX = -normalY;
          const perpY = normalX;

          // Cast shadow rays in a cone (1 cell wide for cliff edges)
          const mapHeight = this.height;
          for (let offset = -1; offset <= 1; offset += 0.5) {
            const rayStartX = x + perpX * offset;
            const rayStartY = y + perpY * offset;

            for (let i = 1; i <= shadowLength; i++) {
              const shadowX = Math.round(rayStartX + normalX * i);
              const shadowY = Math.round(rayStartY + normalY * i);
              if (
                shadowX < 0 || shadowX >= width || shadowY < 0 ||
                shadowY >= mapHeight
              ) break;
              blocked[shadowY * width + shadowX] = 1;
            }
          }
        }
        continue; // Don't add neighbors - cliff stops vision
      }

      // Mark as visible
      const cellIndex = y * width + x;
      const cell = this.cells[y][x];
      if (!oldMark[cellIndex]) {
        cell.visibleCount++;
        if (cell.visibleCount === 1) {
          cell.isVisible = true;
          this.modifiedCells.add(cellIndex);
        }
      }
      newMark[cellIndex] = 1;
      newViewshed.push(cellIndex);

      // Check if blocked by entity - mark cells behind the blocker
      const blockerRow = blockerGrid.get(y);
      if (blockerRow?.has(x)) {
        const blocker = blockerAtCell.get(y)?.get(x);
        if (blocker && blocker.blocksLineOfSight) {
          const heightDiff = Math.abs(height - entityHeight);
          if (heightDiff < blocker.blocksLineOfSight) {
            // Cast a shadow cone behind this blocker
            // Calculate direction from viewer to blocker
            const dirX = x - cx;
            const dirY = y - cy;
            const dist = Math.sqrt(dirX * dirX + dirY * dirY);
            if (dist > 0.1) {
              const normalX = dirX / dist;
              const normalY = dirY / dist;

              // Cast shadow rays in a small cone to account for blocker width
              const shadowLength = Math.ceil(
                effectiveSightRadius * FOG_RESOLUTION_MULTIPLIER,
              );

              // Perpendicular vector for cone width
              const perpX = -normalY;
              const perpY = normalX;

              // Cast multiple shadow rays to fill the cone
              // Use blocker's radius to determine cone width (convert to fog cells)
              const blockerRadius = blocker.radius ?? 0.5;
              const coneWidth = blockerRadius * FOG_RESOLUTION_MULTIPLIER;
              const mapHeight = this.height;
              for (
                let offset = -coneWidth;
                offset <= coneWidth;
                offset += 0.5
              ) {
                const rayStartX = x + perpX * offset;
                const rayStartY = y + perpY * offset;

                // Start shadow from next cell (i=1 instead of i=0)
                for (let i = 1; i <= shadowLength; i++) {
                  const shadowX = Math.round(rayStartX + normalX * i);
                  const shadowY = Math.round(rayStartY + normalY * i);
                  if (
                    shadowX < 0 || shadowX >= width || shadowY < 0 ||
                    shadowY >= mapHeight
                  ) break;
                  blocked[shadowY * width + shadowX] = 1;
                }
              }
            }
            // Still add neighbors so we can see around the blocker
          }
        }
      }

      const mapHeight = this.height;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= mapHeight) continue;
        const rowBase = ny * width;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const idx = rowBase + nx;
          if (visited[idx]) continue;
          visited[idx] = 1;
          queueX[queueTail] = nx;
          queueY[queueTail] = ny;
          queueTail++;
        }
      }
    }

    // Differential update: cells in old viewshed but not new lose this entity.
    // Also clears oldMark in the same pass for cheap scratch reset.
    if (oldViewshed) {
      for (let i = 0; i < oldViewshed.length; i++) {
        const idx = oldViewshed[i];
        if (!newMark[idx]) {
          const cellY = (idx / width) | 0;
          const cellX = idx - cellY * width;
          const cell = this.cells[cellY][cellX];
          cell.visibleCount--;
          if (cell.visibleCount === 0) {
            cell.isVisible = false;
            this.modifiedCells.add(idx);
          }
        }
        oldMark[idx] = 0;
      }
    }

    // Reset newMark scratch.
    for (let i = 0; i < newViewshed.length; i++) {
      newMark[newViewshed[i]] = 0;
    }

    this.entityToViewshed.set(entity, newViewshed);
  }

  removeEntity(entity: Entity) {
    const viewshed = this.entityToViewshed.get(entity);
    if (!viewshed) return;

    const width = this.width;
    for (let i = 0; i < viewshed.length; i++) {
      const idx = viewshed[i];
      const cellY = (idx / width) | 0;
      const cellX = idx - cellY * width;
      const cell = this.cells[cellY][cellX];
      cell.visibleCount--;
      if (cell.visibleCount === 0) {
        cell.isVisible = false;
        this.modifiedCells.add(idx);
      }
    }

    this.entityToViewshed.delete(entity);
    this.entityLastPos.delete(entity);
  }

  updateFog() {
    // modifiedCells now only contains cells whose isVisible transitioned, so
    // every entry corresponds to a fogData byte that needs flipping.
    const width = this.width;
    const fogData = this.fogData;
    for (const cellIndex of this.modifiedCells) {
      const y = (cellIndex / width) | 0;
      const x = cellIndex - y * width;
      fogData[cellIndex] = this.cells[y][x].isVisible ? 255 : 0;
    }

    // Don't clear modifiedCells here - getEntitiesNeedingUpdate() needs it
    this.fogTexture.needsUpdate = true;
  }

  isVisible(x: number, y: number): boolean {
    const fx = Math.floor(x * FOG_RESOLUTION_MULTIPLIER);
    const fy = Math.floor(y * FOG_RESOLUTION_MULTIPLIER);
    if (fx < 0 || fx >= this.width || fy < 0 || fy >= this.height) return false;
    return this.cells[fy][fx].visibleCount > 0;
  }

  isPositionVisible(x: number, y: number): boolean {
    return this.isVisible(x, y);
  }

  getEntitiesNeedingUpdate(): Set<Entity> {
    const entities = new Set<Entity>();

    // modifiedCells contains exactly the cells whose isVisible transitioned;
    // any entity standing in (or near) one of those cells may need a refresh.
    const width = this.width;
    const height = this.height;
    const entityGridMap = this.entityGridMap;
    for (const cellIndex of this.modifiedCells) {
      const y = (cellIndex / width) | 0;
      const x = cellIndex - y * width;

      // Check entities in a small radius around changed cells (±2 for entity size)
      for (let dy = -2; dy <= 2; dy++) {
        const cy = y + dy;
        if (cy < 0 || cy >= height) continue;
        const row = entityGridMap[cy];
        if (!row) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const cx = x + dx;
          if (cx < 0 || cx >= width) continue;
          const cellEntities = row.get(cx);
          if (!cellEntities) continue;
          for (const entity of cellEntities) {
            entities.add(entity);
          }
        }
      }
    }

    return entities;
  }

  getVisionProvidingEntities(): Entity[] {
    // Return a copy to avoid concurrent modification issues when caller
    // modifies visibility during iteration
    return Array.from(this.entityToViewshed.keys());
  }
}
