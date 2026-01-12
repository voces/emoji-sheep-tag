import { app, Entity, map, registerFogReset, SystemEntity } from "../ecs.ts";
import { getLocalPlayer } from "../api/player.ts";
import {
  getMap,
  getMapBounds,
  getMapHeight,
  getMapWidth,
  getTerrainLayers,
  onMapChange,
} from "@/shared/map.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

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
import { isAlly, isInvisible, isStructure, isTree } from "@/shared/api/unit.ts";
import { addSystem } from "@/shared/context.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import {
  canSeeTarget,
  getMaxEntityHeight,
  getMinEntityHeight,
} from "@/shared/visibility.ts";
import { iterateViewersInRange } from "@/shared/systems/vision.ts";

// Fog resolution multiplier: 2 = 160x160, 4 = 320x320, etc.
const FOG_RESOLUTION_MULTIPLIER = 4;

// Cache last-seen state for structures in fog
type FogSnapshot = {
  model: string | undefined;
  progress: number | null | undefined;
};
const fogSnapshots = new WeakMap<Entity, FogSnapshot>();

// Store pending server values that were blocked while entity was in fog
type PendingServerValues = {
  model?: string | null;
  prefab?: string | null;
  progress?: number | null;
};
const pendingServerValues = new WeakMap<Entity, PendingServerValues>();

// Track entities that should be removed when revealed (server deleted them while in fog)
// Using Set instead of WeakSet to allow iteration for sheep death cleanup
const pendingRemoval = new Set<Entity>();

/** Mark an entity for removal when it becomes visible (structure destroyed in fog) */
export const markPendingRemoval = (entity: Entity) => {
  pendingRemoval.add(entity);
};

/** Check if an entity is pending removal */
export const isPendingRemoval = (entity: Entity): boolean =>
  pendingRemoval.has(entity);

/** Remove an entity from pending removal and clean up its fog state */
const removePendingEntity = (entity: Entity) => {
  pendingRemoval.delete(entity);
  fogSnapshots.delete(entity);
  pendingServerValues.delete(entity);
  app.removeEntity(entity);
  delete map[entity.id];
};

/** Remove all pending entities matching a filter predicate */
export const removePendingEntitiesWhere = (
  predicate: (entity: Entity) => boolean,
) => {
  for (const entity of pendingRemoval) {
    if (predicate(entity)) removePendingEntity(entity);
  }
};

const snapshotEntity = (entity: Entity): FogSnapshot => ({
  model: entity.model ?? entity.prefab,
  progress: entity.progress,
});

/** Get snapshotted values for an entity if it has a fog snapshot */
export const getFogSnapshot = (entity: Entity): FogSnapshot | undefined =>
  fogSnapshots.get(entity);

/** Store pending server values that were blocked while entity is in fog */
export const storePendingServerValues = (
  entity: Entity,
  values: PendingServerValues,
) => {
  const existing = pendingServerValues.get(entity) ?? {};
  // Only merge values that are not undefined (undefined means "not in this patch")
  const merged = { ...existing };
  if (values.model !== undefined) merged.model = values.model;
  if (values.prefab !== undefined) merged.prefab = values.prefab;
  if (values.progress !== undefined) merged.progress = values.progress;
  pendingServerValues.set(entity, merged);
};

/** Apply pending server values when entity becomes visible, then clear them */
const applyPendingServerValues = (entity: Entity) => {
  const pending = pendingServerValues.get(entity);
  if (pending) {
    if (pending.model !== undefined) entity.model = pending.model ?? undefined;
    if (pending.prefab !== undefined) {
      entity.prefab = pending.prefab ?? undefined;
    }
    if (pending.progress !== undefined) entity.progress = pending.progress;
    pendingServerValues.delete(entity);
  }
};

export const alwaysVisible = (entity: Entity) =>
  entity.type === "cosmetic" || entity.type === "static" || isTree(entity) ||
  entity.id.startsWith("blueprint-") ||
  entity.id.startsWith("paste-blueprint-") ||
  entity.id === "selection-rectangle" ||
  // TODO: this is a hack; find an alternative?
  entity.model === "glow";

type Cell = {
  visible: Set<Entity>;
  isVisible: boolean; // Cache for visible.size > 0
  x: number;
  y: number;
};

// Track entities that block line of sight (for quick lookup)
const blockerMap = new Map<string, Entity>();

// Track entities by grid cell for efficient fog updates (y -> x -> entities)
const entityGridMap = new Map<number, Map<number, Set<Entity>>>();

let terrainLayerData = getTerrainLayers();
let fogBounds = getMapBounds();
let currentFogMapId = getMap().id;

// Get fog grid bounds for an entity, considering tilemap if present
const getEntityFogBounds = (
  entity: Entity,
): { minX: number; maxX: number; minY: number; maxY: number } => {
  if (!entity.position) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  if (entity.tilemap) {
    // Tilemaps use pathing scale (4 per world unit)
    const PATHING_SCALE = 4;
    const worldMinX = entity.position.x + entity.tilemap.left / PATHING_SCALE;
    const worldMaxX = entity.position.x +
      (entity.tilemap.left + entity.tilemap.width) / PATHING_SCALE;
    const worldMinY = entity.position.y + entity.tilemap.top / PATHING_SCALE;
    const worldMaxY = entity.position.y +
      (entity.tilemap.top + entity.tilemap.height) / PATHING_SCALE;

    return {
      minX: Math.floor(worldMinX * FOG_RESOLUTION_MULTIPLIER),
      maxX: Math.floor(worldMaxX * FOG_RESOLUTION_MULTIPLIER),
      minY: Math.floor(worldMinY * FOG_RESOLUTION_MULTIPLIER),
      maxY: Math.floor(worldMaxY * FOG_RESOLUTION_MULTIPLIER),
    };
  }

  // Non-tilemap entities just use center position
  const x = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
  const y = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);
  return { minX: x, maxX: x, minY: y, maxY: y };
};

const addEntityToGrid = (entity: Entity) => {
  if (!entity.position) return;
  const bounds = getEntityFogBounds(entity);

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    let row = entityGridMap.get(y);
    if (!row) {
      row = new Map();
      entityGridMap.set(y, row);
    }
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      let cell = row.get(x);
      if (!cell) {
        cell = new Set();
        row.set(x, cell);
      }
      cell.add(entity);
    }
  }
};

const removeEntityFromGrid = (
  entity: Entity,
  position?: { x: number; y: number },
) => {
  const pos = position ?? entity.position;
  if (!pos) return;

  // Reconstruct bounds using the provided position
  const bounds = entity.tilemap
    ? (() => {
      const PATHING_SCALE = 4;
      const worldMinX = pos.x + entity.tilemap.left / PATHING_SCALE;
      const worldMaxX = pos.x +
        (entity.tilemap.left + entity.tilemap.width) / PATHING_SCALE;
      const worldMinY = pos.y + entity.tilemap.top / PATHING_SCALE;
      const worldMaxY = pos.y +
        (entity.tilemap.top + entity.tilemap.height) / PATHING_SCALE;
      return {
        minX: Math.floor(worldMinX * FOG_RESOLUTION_MULTIPLIER),
        maxX: Math.floor(worldMaxX * FOG_RESOLUTION_MULTIPLIER),
        minY: Math.floor(worldMinY * FOG_RESOLUTION_MULTIPLIER),
        maxY: Math.floor(worldMaxY * FOG_RESOLUTION_MULTIPLIER),
      };
    })()
    : {
      minX: Math.floor(pos.x * FOG_RESOLUTION_MULTIPLIER),
      maxX: Math.floor(pos.x * FOG_RESOLUTION_MULTIPLIER),
      minY: Math.floor(pos.y * FOG_RESOLUTION_MULTIPLIER),
      maxY: Math.floor(pos.y * FOG_RESOLUTION_MULTIPLIER),
    };

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    const row = entityGridMap.get(y);
    if (!row) continue;
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const cell = row.get(x);
      if (!cell) continue;
      cell.delete(entity);
      if (cell.size === 0) {
        row.delete(x);
        if (row.size === 0) {
          entityGridMap.delete(y);
        }
      }
    }
  }
};

// Check if an entity provides visibility for the local player
// Observers see all entities, pending users only see wolves, others see allies
export const visibleToLocalPlayer = (entity: Entity): boolean => {
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return false;

  const localTeam = localPlayer.team;

  // Observers see all entities
  if (localTeam === "observer") return true;

  // Pending users only see wolf team entities
  if (localTeam === "pending") {
    const entityOwner = getPlayer(entity.owner);
    return entityOwner?.team === "wolf";
  }

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
  readonly modifiedCells: Set<number> = new Set(); // Cells modified in this update

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
    const entityHeight = terrainLayerData[entityTileY]?.[entityTileX] ?? 0;

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

    // Use flood fill with shadow casting for blockers and cliffs
    const radiusSquared = (entity.sightRadius * FOG_RESOLUTION_MULTIPLIER) ** 2;
    const visited = new Set<number>();
    const blocked = new Set<number>(); // Cells in shadow of blockers/cliffs
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
      const terrainRow = terrainLayerData[terrainY];
      const height = terrainRow?.[terrainX] ?? 0;

      if (height > entityHeight) {
        // Cliff blocks - cast shadow behind it
        const dist = Math.sqrt(distSquared);
        if (dist > 0.1) {
          const normalX = dx / dist;
          const normalY = dy / dist;

          // Cast shadow from this cliff cell
          const shadowLength = Math.ceil(
            entity.sightRadius * FOG_RESOLUTION_MULTIPLIER,
          );

          // Perpendicular vector for cone width
          const perpX = -normalY;
          const perpY = normalX;

          // Cast shadow rays in a cone (1 cell wide for cliff edges)
          for (let offset = -1; offset <= 1; offset += 0.5) {
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
        continue; // Don't add neighbors - cliff stops vision
      }

      // Mark as visible
      const cellIndex = y * this.width + x;
      const cell = this.cells[y][x];
      const wasVisible = cell.isVisible;
      cell.visible.add(entity);
      if (!wasVisible) cell.isVisible = true;
      newCells.add(cell);
      newCellKeys.add(cellIndex);
      this.modifiedCells.add(cellIndex);

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

                // Start shadow from next cell (i=1 instead of i=0)
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
            // Still add neighbors so we can see around the blocker
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

    // Don't clear modifiedCells here - getEntitiesNeedingUpdate() needs it
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

    // Also check modifiedCells in addition to changedCells
    // This catches cases where visibility providers change but cell visibility stays the same
    const cellsToCheck = new Set([...this.changedCells, ...this.modifiedCells]);

    // Check all changed cells and collect entities in those cells
    for (const cellIndex of cellsToCheck) {
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
          const row = entityGridMap.get(cy);
          if (row) {
            const cellEntities = row.get(cx);
            if (cellEntities) {
              for (const entity of cellEntities) {
                entities.add(entity);
              }
            }
          }
        }
      }
    }

    return entities;
  }

  getVisionProvidingEntities(): Entity[] {
    // Return a copy to avoid concurrent modification issues when caller
    // modifies visibility during iteration
    return Array.from(this.entityToCells.keys());
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

const createVisibilityGrid = () =>
  new VisibilityGrid(
    getMapWidth() * FOG_RESOLUTION_MULTIPLIER,
    getMapHeight() * FOG_RESOLUTION_MULTIPLIER,
  );

export let visibilityGrid = createVisibilityGrid();

const createFogPass = () => {
  if (!renderTarget?.depthTexture) return;
  const map = getMap();
  const pass = new FogPass(
    visibilityGrid.fogTexture,
    renderTarget.depthTexture,
    camera,
    { width: map.width, height: map.height, bounds: map.bounds },
  );
  pass.renderToScreen = true;
  setFogPass(pass);
  return pass;
};

if (renderTarget?.depthTexture) {
  createFogPass();
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

const triggerFogChecks = () => {
  visibilityGrid.updateFog();

  // After updating fog, recalculate visibility only for entities in changed areas
  const entitiesToUpdate = visibilityGrid.getEntitiesNeedingUpdate();
  for (const entity of entitiesToUpdate) {
    if (entity.position) {
      handleEntityVisibility(entity as SystemEntity<"position">);
    }
  }

  // Clear modifiedCells after using it
  visibilityGrid.modifiedCells.clear();
};

// System to track visibility
const sightedEntities = new Set<SystemEntity<"position" | "sightRadius">>();
addSystem({
  props: ["position", "sightRadius"],
  entities: sightedEntities,
  onAdd: (entity) => {
    if (!visibleToLocalPlayer(entity)) return;
    visibilityGrid.updateEntity(entity);
  },
  onChange: (entity) => {
    if (!visibleToLocalPlayer(entity)) return;
    visibilityGrid.updateEntity(entity);
  },
  onRemove: (entity) => {
    visibilityGrid.removeEntity(entity);
  },
  update: triggerFogChecks,
});

// Track old positions for entity grid updates
const entityOldPositions = new WeakMap<Entity, { x: number; y: number }>();

// System to maintain entity spatial grid
addSystem({
  props: ["position"],
  onAdd: (entity) => {
    if (alwaysVisible(entity)) return;
    addEntityToGrid(entity);
    entityOldPositions.set(entity, {
      x: entity.position.x,
      y: entity.position.y,
    });
  },
  onChange: (entity) => {
    if (alwaysVisible(entity)) return;
    const oldPos = entityOldPositions.get(entity);
    if (oldPos) {
      // For tilemapped entities, always remove/re-add since bounds may span many cells
      // For non-tilemapped entities, only update if center cell changed
      if (entity.tilemap) {
        removeEntityFromGrid(entity, oldPos);
        addEntityToGrid(entity);
      } else {
        const oldX = Math.floor(oldPos.x * FOG_RESOLUTION_MULTIPLIER);
        const oldY = Math.floor(oldPos.y * FOG_RESOLUTION_MULTIPLIER);
        const newX = Math.floor(entity.position.x * FOG_RESOLUTION_MULTIPLIER);
        const newY = Math.floor(entity.position.y * FOG_RESOLUTION_MULTIPLIER);

        if (oldX !== newX || oldY !== newY) {
          removeEntityFromGrid(entity, oldPos);
          addEntityToGrid(entity);
        }
      }
    }
    entityOldPositions.set(entity, {
      x: entity.position.x,
      y: entity.position.y,
    });
  },
  onRemove: (entity) => {
    if (alwaysVisible(entity)) return;
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
registerFogReset(resetFog);

const rebuildFogResources = () => {
  terrainLayerData = getTerrainLayers();
  fogBounds = getMapBounds();
  visibilityGrid = createVisibilityGrid();
  entityGridMap.clear();
  for (const entity of app.entities) {
    if (alwaysVisible(entity)) continue;
    addEntityToGrid(entity);
  }
  everSeen.clear();
  for (const entity of sightedEntities) {
    if (visibleToLocalPlayer(entity)) {
      visibilityGrid.updateEntity(entity);
    }
  }
  createFogPass();
  triggerFogChecks();
};

onMapChange((map) => {
  if (map.id === currentFogMapId) return;
  currentFogMapId = map.id;
  rebuildFogResources();
});

// Get blockers in range for visibility checks
const getBlockersInRange = (x: number, y: number, radius: number) =>
  getEntitiesInRange(x, y, radius).filter(
    (
      e,
    ): e is Entity & {
      position: { x: number; y: number };
      blocksLineOfSight: number;
    } => !!e.blocksLineOfSight && !!e.position,
  );

// Check if any allied entity can see the target entity using LOS checks
const canAllySeeEntity = (target: Entity): boolean => {
  if (!target.position) return false;

  const localPlayer = getLocalPlayer();
  if (!localPlayer) return false;

  const localTeam = localPlayer.team;

  // Observers see everything
  if (localTeam === "observer") return true;

  // Determine which team(s) to check
  const teamsToCheck: ("sheep" | "wolf")[] = localTeam === "pending"
    ? ["wolf"] // Pending users only see wolf team
    : localTeam === "sheep" || localTeam === "wolf"
    ? [localTeam]
    : [];

  if (teamsToCheck.length === 0) return false;

  const terrainLayers = getTerrainLayers();
  const targetIsInvisible = isInvisible(target);

  // Get target's terrain height for early-out (use min height for tilemaps)
  const targetHeight = getMinEntityHeight(
    target.position,
    target.tilemap,
    terrainLayers,
  );

  // Use KD tree to efficiently find nearby viewers
  for (const team of teamsToCheck) {
    for (
      const viewer of iterateViewersInRange(
        team,
        target.position.x,
        target.position.y,
      )
    ) {
      // Invisible targets require trueVision to see
      if (targetIsInvisible && !viewer.trueVision) continue;

      // Early out: if target is higher than viewer, viewer can't see target
      const viewerHeight = getMaxEntityHeight(
        viewer.position,
        viewer.tilemap,
        terrainLayers,
      );
      if (targetHeight > viewerHeight) continue;

      if (
        canSeeTarget(
          {
            position: viewer.position,
            sightRadius: viewer.sightRadius,
            id: viewer.id,
            tilemap: viewer.tilemap,
          },
          { position: target.position, tilemap: target.tilemap },
          terrainLayers,
          getBlockersInRange,
        )
      ) return true;
    }
  }
  return false;
};

// System to hide enemy units in fog (but keep structures visible once seen)
const handleEntityVisibility = (entity: Entity) => {
  if (alwaysVisible(entity) || !entity.position) return;

  // If view mode is enabled, disable fog entirely
  if (lobbySettingsVar().view) {
    if (entity.hiddenByFog) delete entity.hiddenByFog;
    fogSnapshots.delete(entity);
    return;
  }

  // Skip allied entities
  if (visibleToLocalPlayer(entity)) {
    if (entity.hiddenByFog) delete entity.hiddenByFog;
    fogSnapshots.delete(entity);
    everSeen.add(entity.id);
    return;
  }

  // Check if any allied unit can see this entity using LOS
  const visible = canAllySeeEntity(entity);

  // Mark as ever seen if currently visible
  if (visible) everSeen.add(entity.id);
  else if (entity.selected) delete entity.selected;

  // For units, hide when not visible
  if (!isStructure(entity)) {
    if (visible) {
      delete entity.hiddenByFog;
      fogSnapshots.delete(entity);
    } else {
      entity.hiddenByFog = true;
    }
    return;
  }

  // For structures: show if ever seen, but invisible structures must be currently visible
  const shouldShow = everSeen.has(entity.id) &&
    (!isInvisible(entity) || visible);

  if (shouldShow) {
    delete entity.hiddenByFog;

    if (visible) {
      // Currently visible - clear snapshot and restore real server values
      fogSnapshots.delete(entity);
      applyPendingServerValues(entity);

      // If entity was marked for removal while in fog, remove it now
      if (pendingRemoval.has(entity)) {
        pendingRemoval.delete(entity);
        app.removeEntity(entity);
        delete map[entity.id];
        return;
      }
    } else {
      // In fog but was seen - create snapshot when entering fog
      if (!fogSnapshots.has(entity)) {
        fogSnapshots.set(entity, snapshotEntity(entity));
      }
      // Note: snapshot values are preserved by filtering updates in messageHandlers.ts
    }
  } else {
    entity.hiddenByFog = true;
  }
};
addSystem({
  props: ["position"],
  onAdd: handleEntityVisibility,
  onChange: handleEntityVisibility,
  onRemove: (e) => {
    // Clean up tracking when entity is removed
    everSeen.delete(e.id);
    // WeakMap auto-cleans when entity is GC'd
  },
});

// Re-check visibility when buffs or progress change (for invisibility)
addSystem({
  props: ["buffs"],
  onAdd: handleEntityVisibility,
  onChange: handleEntityVisibility,
  onRemove: handleEntityVisibility,
});
addSystem({
  props: ["progress"],
  onAdd: handleEntityVisibility,
  onRemove: handleEntityVisibility,
});

// TODO: run only once (a swap runs twice)
addSystem({
  props: ["isPlayer", "team"],
  onChange: (e) => {
    // If local player's team changed, clear ever-seen structures
    const localPlayer = getLocalPlayer();
    if (localPlayer && e.id === localPlayer.id) {
      everSeen.clear();
    }

    // Remove all currently tracked entities
    for (const entity of sightedEntities) {
      if (visibleToLocalPlayer(entity)) visibilityGrid.updateEntity(entity);
      else visibilityGrid.removeEntity(entity);
    }

    // Update fog to reflect changes from entity removal/addition
    triggerFogChecks();
  },
});

// Handle owner changes (e.g., giving units to enemy in practice mode)
addSystem({
  props: ["owner", "sightRadius"],
  onChange: (entity) => {
    // Check if this entity should provide vision based on new owner
    if (visibleToLocalPlayer(entity)) {
      visibilityGrid.updateEntity(entity);
    } else {
      visibilityGrid.removeEntity(entity);
    }

    // Update fog to reflect changes
    triggerFogChecks();
  },
});
