import { Entity, SystemEntity } from "../ecs.ts";
import { getLocalPlayer } from "@/vars/players.ts";
import { height, terrainLayers, width } from "@/shared/map.ts";

// Fog resolution multiplier: 2 = 160x160, 4 = 320x320, etc.
const FOG_RESOLUTION_MULTIPLIER = 4;
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from "three";
import {
  camera,
  fogPass,
  renderer,
  renderTarget,
  setFogPass,
} from "../graphics/three.ts";
import { FogPass } from "../graphics/FogPass.ts";
import { isAlly, isStructure, isTree } from "@/shared/api/unit.ts";
import { addSystem } from "@/shared/context.ts";
import { getEntitiesInRange } from "./kd.ts";
import { getPlayerTeam } from "@/shared/api/player.ts";

type Cell = {
  visible: Set<Entity>;
  isVisible: boolean; // Cache for visible.size > 0
  x: number;
  y: number;
};

// Track entities that block line of sight (for quick lookup)
const blockerMap = new Map<string, Entity>();

// Track entities by grid cell for efficient fog updates
const entityGridMap = new Map<string, Set<Entity>>();

const addEntityToGrid = (entity: Entity) => {
  if (!entity.position) return;
  const x = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
  const y = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);
  const key = `${x},${y}`;
  if (!entityGridMap.has(key)) {
    entityGridMap.set(key, new Set());
  }
  entityGridMap.get(key)!.add(entity);
};

const removeEntityFromGrid = (entity: Entity) => {
  if (!entity.position) return;
  const x = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
  const y = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);
  const key = `${x},${y}`;
  const set = entityGridMap.get(key);
  if (set) {
    set.delete(entity);
    if (set.size === 0) {
      entityGridMap.delete(key);
    }
  }
};

// Check if an entity is allied with the local player
// Observers (neutral team) see all entities
const isAlliedWithLocalPlayer = (entity: Entity): boolean => {
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return false;

  // If local player is neutral (observer), grant vision from all entities
  const localTeam = getPlayerTeam(localPlayer.id);
  if (localTeam === "neutral") return true;

  return isAlly(localPlayer.id, entity);
};

class VisibilityGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly cells: Cell[][];
  private readonly entityToCells: Map<Entity, Set<Cell>> = new Map();
  private readonly entityLastPos: Map<Entity, { x: number; y: number }> =
    new Map();
  readonly fogTexture: DataTexture;
  private readonly fogData: Uint8Array;
  private readonly changedCells: Set<number> = new Set();
  private readonly modifiedCells: Set<number> = new Set(); // Cells modified in this update

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array.from(
      { length: height },
      (_, y) =>
        Array.from({ length: width }, (_, x) => ({
          visible: new Set<Entity>(),
          isVisible: false,
          x,
          y,
        })),
    );

    this.fogData = new Uint8Array(width * height);

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

    const cx = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
    const cy = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);

    // Short-circuit if entity hasn't moved enough (stays within same fog cell)
    const lastPos = this.entityLastPos.get(entity);
    if (lastPos && lastPos.x === cx && lastPos.y === cy) {
      return; // No visibility change needed
    }
    this.entityLastPos.set(entity, { x: cx, y: cy });

    const oldCells = this.entityToCells.get(entity);
    const newCells = new Set<Cell>();
    const newCellKeys = new Set<number>();
    const r = Math.ceil(entity.sightRadius * FOG_RESOLUTION_MULTIPLIER);

    // Get entity's height level (terrainLayers is 2x resolution)
    const terrainScale = FOG_RESOLUTION_MULTIPLIER / 2;
    const entityTileX = Math.floor(cx / terrainScale);
    const entityTileY = Math.floor(cy / terrainScale);
    const entityHeight = terrainLayers[entityTileY]?.[entityTileX] ?? 0;

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

    // Use flood fill with shadow casting for blockers
    const radiusSquared = (entity.sightRadius * FOG_RESOLUTION_MULTIPLIER) ** 2;
    const visited = new Set<number>();
    const blocked = new Set<number>(); // Cells in shadow of blockers
    const queue: { x: number; y: number }[] = [{
      x: cx,
      y: cy,
    }];

    visited.add(cy * this.width + cx);

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      // Skip if this cell is in a shadow
      if (blocked.has(y * this.width + x)) continue;

      // Check distance
      const dx = x - cx;
      const dy = y - cy;
      const distSquared = dx * dx + dy * dy;
      if (distSquared > radiusSquared) continue;

      // Check height blocking
      const terrainX = Math.floor(x / terrainScale);
      const terrainY = Math.floor(y / terrainScale);
      const terrainRow = terrainLayers[terrainY];
      const height = terrainRow?.[terrainX] ?? 0;

      if (height > entityHeight) continue; // Cliff blocks

      // Mark as visible
      const cellIndex = y * this.width + x;
      const cell = this.cells[y][x];
      const wasVisible = cell.isVisible;
      cell.visible.add(entity);
      if (!wasVisible) cell.isVisible = true;
      newCells.add(cell);
      newCellKeys.add(cellIndex);
      this.modifiedCells.add(cellIndex);

      // Check if blocked by entity
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
                entity.sightRadius * FOG_RESOLUTION_MULTIPLIER,
              );

              // Perpendicular vector for cone width
              const perpX = -normalY;
              const perpY = normalX;

              // Cast multiple shadow rays to fill the cone
              // Use blocker's radius to determine cone width (convert to fog cells)
              const blockerRadius = blocker.radius ?? 0.5;
              const coneWidth = blockerRadius * FOG_RESOLUTION_MULTIPLIER;
              for (
                let offset = -coneWidth;
                offset <= coneWidth;
                offset += 0.5
              ) {
                const rayStartX = x + perpX * offset;
                const rayStartY = y + perpY * offset;

                for (let i = 1; i <= shadowLength; i++) {
                  const shadowX = Math.round(rayStartX + normalX * i);
                  const shadowY = Math.round(rayStartY + normalY * i);
                  if (
                    shadowX >= 0 && shadowX < this.width && shadowY >= 0 &&
                    shadowY < this.height
                  ) {
                    blocked.add(shadowY * this.width + shadowX);
                  }
                }
              }
            }
            // Don't add neighbors - this blocker stops vision
            continue;
          }
        }
      }

      // Add neighbors to queue
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
        { x: x + 1, y: y + 1 },
        { x: x + 1, y: y - 1 },
        { x: x - 1, y: y + 1 },
        { x: x - 1, y: y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.x < 0 || neighbor.x >= this.width || neighbor.y < 0 ||
          neighbor.y >= this.height
        ) continue;
        const neighborIndex = neighbor.y * this.width + neighbor.x;
        if (visited.has(neighborIndex)) continue;
        visited.add(neighborIndex);
        queue.push({
          x: neighbor.x,
          y: neighbor.y,
        });
      }
    }

    // Differential update: remove entity from cells it no longer sees
    if (oldCells) {
      for (const cell of oldCells) {
        if (!newCells.has(cell)) {
          cell.visible.delete(entity);
          cell.isVisible = cell.visible.size > 0;
          this.modifiedCells.add(cell.y * this.width + cell.x);
        }
      }
    }

    this.entityToCells.set(entity, newCells);
  }

  removeEntity(entity: Entity) {
    const cells = this.entityToCells.get(entity);
    if (!cells) return;

    for (const cell of cells) {
      cell.visible.delete(entity);
      cell.isVisible = cell.visible.size > 0;
      // Mark cell as modified so fog updates
      this.modifiedCells.add(cell.y * this.width + cell.x);
    }

    this.entityToCells.delete(entity);
    this.entityLastPos.delete(entity);
  }

  updateFog() {
    // Clear changed cells from last frame
    this.changedCells.clear();

    // Only iterate cells that were modified in this update
    for (const cellIndex of this.modifiedCells) {
      const y = Math.floor(cellIndex / this.width);
      const x = cellIndex % this.width;
      const cell = this.cells[y][x];
      const visible = cell.isVisible;

      const oldValue = this.fogData[cellIndex];
      const newValue = visible ? 255 : 0;

      if (oldValue !== newValue) {
        this.fogData[cellIndex] = newValue;
        this.changedCells.add(cellIndex);
      }
    }

    this.modifiedCells.clear(); // Clear for next frame
    this.fogTexture.needsUpdate = true;
  }

  isVisible(x: number, y: number): boolean {
    const fx = Math.floor(x * FOG_RESOLUTION_MULTIPLIER);
    const fy = Math.floor(y * FOG_RESOLUTION_MULTIPLIER);
    if (fx < 0 || fx >= this.width || fy < 0 || fy >= this.height) return false;
    return this.cells[fy][fx].visible.size > 0;
  }

  isPositionVisible(x: number, y: number): boolean {
    return this.isVisible(x, y);
  }

  getEntitiesNeedingUpdate(): Set<Entity> {
    const entities = new Set<Entity>();

    // Check all changed cells and collect entities in those cells
    for (const cellIndex of this.changedCells) {
      const y = Math.floor(cellIndex / this.width);
      const x = cellIndex % this.width;

      // Check entities in a small radius around changed cells (±2 for entity size)
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const cx = x + dx;
          const cy = y + dy;

          if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) {
            continue;
          }

          // Get entities at this grid cell
          const cellEntities = entityGridMap.get(`${cx},${cy}`);
          if (cellEntities) {
            for (const entity of cellEntities) {
              entities.add(entity);
            }
          }
        }
      }
    }

    return entities;
  }

  reset() {
    // Clear all visibility tracking
    this.entityToCells.clear();
    this.entityLastPos.clear();
    this.modifiedCells.clear();
    this.changedCells.clear();

    // Reset all cells to not visible
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        cell.visible.clear();
        cell.isVisible = false;
      }
    }

    // Clear fog data
    this.fogData.fill(0);
    this.fogTexture.needsUpdate = true;
  }
}

const visibilityGrid = new VisibilityGrid(
  width * FOG_RESOLUTION_MULTIPLIER,
  height * FOG_RESOLUTION_MULTIPLIER,
);

if (renderTarget?.depthTexture) {
  const pass = new FogPass(
    visibilityGrid.fogTexture,
    renderTarget.depthTexture,
    camera,
  );
  pass.renderToScreen = true;
  setFogPass(pass);
}

// System to track blockers (kept for quick filtering, but KDTree does spatial queries)
addSystem({
  props: ["position", "blocksLineOfSight"],
  onAdd: (entity) => {
    blockerMap.set(entity.id, entity);
  },
  onChange: (entity) => {
    blockerMap.set(entity.id, entity);
  },
  onRemove: (entity) => {
    blockerMap.delete(entity.id);
  },
});

// System to track visibility
addSystem({
  props: ["position", "sightRadius"],
  onAdd: (entity) => {
    if (!isAlliedWithLocalPlayer(entity)) return;
    visibilityGrid.updateEntity(entity);
  },
  onChange: (entity) => {
    if (!isAlliedWithLocalPlayer(entity)) return;
    visibilityGrid.updateEntity(entity);
  },
  onRemove: (entity) => {
    visibilityGrid.removeEntity(entity);
  },
  update: () => {
    visibilityGrid.updateFog();

    // After updating fog, recalculate visibility only for entities in changed areas
    const entitiesToUpdate = visibilityGrid.getEntitiesNeedingUpdate();
    for (const entity of entitiesToUpdate) {
      if (entity.position) {
        handleEntityVisibility(entity as SystemEntity<"position">);
      }
    }
  },
});

// Track old positions for entity grid updates
const entityOldPositions = new WeakMap<Entity, { x: number; y: number }>();

// System to maintain entity spatial grid
addSystem({
  props: ["position"],
  onAdd: (entity) => {
    addEntityToGrid(entity);
    entityOldPositions.set(entity, {
      x: entity.position.x,
      y: entity.position.y,
    });
  },
  onChange: (entity) => {
    // Remove from old position
    const oldPos = entityOldPositions.get(entity);
    if (oldPos) {
      const oldX = Math.floor(oldPos.x * FOG_RESOLUTION_MULTIPLIER);
      const oldY = Math.floor(oldPos.y * FOG_RESOLUTION_MULTIPLIER);
      const newX = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
      const newY = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);

      // Only update if grid cell changed
      if (oldX !== newX || oldY !== newY) {
        const oldKey = `${oldX},${oldY}`;
        const oldSet = entityGridMap.get(oldKey);
        if (oldSet) {
          oldSet.delete(entity);
          if (oldSet.size === 0) {
            entityGridMap.delete(oldKey);
          }
        }
        // Add to new position
        addEntityToGrid(entity);
      }
    }
    entityOldPositions.set(entity, {
      x: entity.position.x,
      y: entity.position.y,
    });
  },
  onRemove: (entity) => {
    removeEntityFromGrid(entity);
    entityOldPositions.delete(entity);
  },
});

// Track which entities have ever been seen
const everSeen = new Set<string>();

export const resetFog = () => {
  everSeen.clear();
  visibilityGrid.reset();
  if (fogPass && renderer) fogPass.reset(renderer);
};

// System to hide enemy units in fog (but keep structures visible once seen)
const handleEntityVisibility = (entity: SystemEntity<"position">) => {
  // These entities are always visible
  if (
    entity.type === "cosmetic" || entity.type === "static" || isTree(entity)
  ) return;
  // Skip allied entities
  if (isAlliedWithLocalPlayer(entity)) {
    if (entity.hiddenByFog) delete entity.hiddenByFog;
    everSeen.add(entity.id);
    return;
  }

  // Check if position is visible
  const visible = visibilityGrid.isPositionVisible(
    entity.position.x,
    entity.position.y,
  );

  // Mark as ever seen if currently visible
  if (visible) everSeen.add(entity.id);

  // For units, hide when not visible
  if (!isStructure(entity)) {
    if (visible) delete entity.hiddenByFog;
    else entity.hiddenByFog = true;
    return;
  }

  // For structures, only show if ever seen
  if (everSeen.has(entity.id)) delete entity.hiddenByFog;
  else entity.hiddenByFog = true;
};
addSystem({
  props: ["position"],
  onAdd: handleEntityVisibility,
  onChange: handleEntityVisibility,
  onRemove: (e) => {
    // Clean up tracking when entity is removed
    everSeen.delete(e.id);
  },
});

export { visibilityGrid };
