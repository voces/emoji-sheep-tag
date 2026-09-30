import { app, Entity, registerFogReset, SystemEntity } from "../ecs.ts";
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
  camera,
  fogPass,
  renderer,
  renderTarget,
  setFogPass,
} from "../graphics/three.ts";
import { FogPass } from "../graphics/FogPass.ts";
import { isAlly, isInvisible, isStructure } from "@/shared/api/unit.ts";
import { addSystem } from "@/shared/context.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import {
  canSeeTarget,
  getMaxEntityHeight,
  getMinEntityHeight,
} from "@/shared/visibility.ts";
import { iterateViewersInRange } from "@/shared/systems/vision.ts";
import { isNight } from "@/shared/dayNight.ts";
import {
  applyPendingServerValues,
  clearFogSnapshot,
  ensureFogSnapshot,
  removeIfPendingRemoval,
} from "./fog/snapshots.ts";
import {
  type EntityGridMap,
  FOG_RESOLUTION_MULTIPLIER,
  VisibilityGrid,
} from "./fog/visibilityGrid.ts";

export {
  getFogSnapshot,
  isPendingRemoval,
  markPendingRemoval,
  removePendingEntitiesWhere,
  storePendingServerValues,
} from "./fog/snapshots.ts";

export const alwaysVisible = (entity: Entity) =>
  typeof entity.visibleInFog === "boolean"
    ? entity.visibleInFog
    : entity.type === "cosmetic" || entity.type === "static";

// Track entities that block line of sight (for quick lookup)
const blockerMap = new Map<string, Entity>();

// Track entities by grid cell for efficient fog updates
const entityGridMap: EntityGridMap = {};

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
    let row = entityGridMap[y];
    if (!row) {
      row = new Map();
      entityGridMap[y] = row;
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
    const row = entityGridMap[y];
    if (!row) continue;
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const cell = row.get(x);
      if (!cell) continue;
      cell.delete(entity);
      if (cell.size === 0) {
        row.delete(x);
        if (row.size === 0) {
          delete entityGridMap[y];
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

const createVisibilityGrid = () =>
  new VisibilityGrid(
    getMapWidth() * FOG_RESOLUTION_MULTIPLIER,
    getMapHeight() * FOG_RESOLUTION_MULTIPLIER,
    { entityGridMap, fogBounds, terrainLayerData },
  );

export let visibilityGrid = createVisibilityGrid();

const createFogPass = () => {
  if (!renderTarget?.depthTexture) return;
  const map = getMap();
  const pass = new FogPass(
    visibilityGrid.fogTexture,
    renderTarget.depthTexture,
    camera,
    {
      width: map.width,
      height: map.height,
      bounds: map.bounds,
      mask: map.mask,
    },
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
let lastNight = false;
let nightTransitionIter:
  | Iterator<SystemEntity<"position" | "sightRadius">>
  | null = null;
const NIGHT_TRANSITION_BUDGET_MS = 2;
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
  update: () => {
    const night = isNight();
    if (night !== lastNight) {
      lastNight = night;
      nightTransitionIter = sightedEntities.values();
    }
    if (nightTransitionIter) {
      const deadline = performance.now() + NIGHT_TRANSITION_BUDGET_MS;
      while (performance.now() < deadline) {
        const next = nightTransitionIter.next();
        if (next.done) {
          nightTransitionIter = null;
          break;
        }
        if (visibleToLocalPlayer(next.value)) {
          visibilityGrid.updateEntity(next.value);
        }
      }
    }
    triggerFogChecks();
  },
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
  visibilityGrid = createVisibilityGrid();
  createFogPass();
  if (fogPass && renderer) fogPass.reset(renderer);
};
registerFogReset(resetFog);

const rebuildFogResources = () => {
  terrainLayerData = getTerrainLayers();
  fogBounds = getMapBounds();
  visibilityGrid = createVisibilityGrid();
  for (const k in entityGridMap) delete entityGridMap[k];
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
    clearFogSnapshot(entity);
    return;
  }

  // Skip allied entities
  if (visibleToLocalPlayer(entity)) {
    if (entity.hiddenByFog) delete entity.hiddenByFog;
    clearFogSnapshot(entity);
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
      clearFogSnapshot(entity);
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
      clearFogSnapshot(entity);
      applyPendingServerValues(entity);

      // If entity was marked for removal while in fog, remove it now
      if (removeIfPendingRemoval(entity)) return;
    } else {
      // In fog but was seen - create snapshot when entering fog
      ensureFogSnapshot(entity);
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
