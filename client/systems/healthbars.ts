import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
} from "three";
import { Entity } from "../ecs.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { getPlayer } from "@/shared/api/player.ts";

export const healthbarScene = new Scene();

// Healthbar dimensions in world units
const BAR_MARGIN = 0.03;
const BAR_HEIGHT = 0.06;

// Colors
const BACKGROUND_COLOR = new Color("#222");

// Maximum number of healthbars to render
const MAX_BARS = 512;

// Create background bar mesh (dark background)
const bgGeometry = new PlaneGeometry(1, 1);
const bgMaterial = new MeshBasicMaterial({
  color: BACKGROUND_COLOR,
  transparent: true,
  opacity: 0.8,
  side: DoubleSide,
  depthWrite: false,
});
const bgMesh = new InstancedMesh(bgGeometry, bgMaterial, MAX_BARS);
bgMesh.frustumCulled = false;
bgMesh.count = 0;
bgMesh.renderOrder = 1000;

// Create foreground bar mesh (player colored health fill)
const fgGeometry = new PlaneGeometry(1, 1);
const fgMaterial = new MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
  side: DoubleSide,
  depthWrite: false,
});

const fgMesh = new InstancedMesh(fgGeometry, fgMaterial, MAX_BARS);
fgMesh.frustumCulled = false;
fgMesh.count = 0;
fgMesh.renderOrder = 1001;

// Instance color buffer for foreground (Three.js uses this automatically)
const instanceColors = new Float32Array(MAX_BARS * 3);
const instanceColorAttribute = new InstancedBufferAttribute(instanceColors, 3);
fgMesh.instanceColor = instanceColorAttribute;

// Track damaged entities
const damagedEntities = new Set<Entity>();
let dirty = false;
let animationId: number | undefined;

// Temp object for matrix calculations
const tempObject = new Object3D();
const tempColor = new Color();

// Add meshes to healthbar scene
healthbarScene.add(bgMesh);
healthbarScene.add(fgMesh);

const isDamaged = (e: Entity) =>
  e.health !== null &&
  e.health !== undefined &&
  e.maxHealth &&
  e.health < e.maxHealth;

const rebuild = () => {
  const settings = gameplaySettingsVar();

  // If disabled, hide everything
  if (!settings.showHealthbars) {
    bgMesh.count = 0;
    fgMesh.count = 0;
    return;
  }

  let count = 0;

  for (const entity of damagedEntities) {
    if (count >= MAX_BARS) break;

    // Skip entities not in the current ECS
    if (!appContext.current.entities.has(entity)) {
      damagedEntities.delete(entity);
      continue;
    }

    const { health, maxHealth, position, owner, hiddenByFog } = entity;

    // Skip if entity is hidden by fog or doesn't have required properties
    if (
      hiddenByFog ||
      health === null ||
      health === undefined ||
      !maxHealth ||
      !position
    ) continue;

    // Skip if full health or dead
    const healthPercent = health / maxHealth;
    if (healthPercent >= 0.9999 || healthPercent <= 0) continue;

    // Get owner's player color
    const ownerPlayer = owner ? getPlayer(owner) : null;
    const playerColor = ownerPlayer?.playerColor ?? "#ffffff";
    tempColor.set(playerColor);

    // Position above entity based on its radius
    const entityRadius = entity.radius ?? 0.25;
    const x = position.x;
    const y = position.y + entityRadius - BAR_HEIGHT / 2 - BAR_MARGIN;

    // Background bar (full width)
    const width = entityRadius * 2 - BAR_MARGIN * 2;
    tempObject.position.set(x, y, 0);
    tempObject.scale.set(width, BAR_HEIGHT, 1);
    tempObject.rotation.set(0, 0, 0);
    tempObject.updateMatrix();
    bgMesh.setMatrixAt(count, tempObject.matrix);

    // Foreground bar (scaled by health %, positioned to align left)
    const fgWidth = width * healthPercent;
    const fgOffset = (width - fgWidth) / 2;
    tempObject.position.set(x - fgOffset, y, 0);
    tempObject.scale.set(fgWidth, BAR_HEIGHT, 1);
    tempObject.updateMatrix();
    fgMesh.setMatrixAt(count, tempObject.matrix);

    // Set instance color for foreground
    instanceColors[count * 3] = tempColor.r;
    instanceColors[count * 3 + 1] = tempColor.g;
    instanceColors[count * 3 + 2] = tempColor.b;

    count++;
  }

  bgMesh.count = count;
  fgMesh.count = count;

  if (count > 0) {
    bgMesh.instanceMatrix.needsUpdate = true;
    fgMesh.instanceMatrix.needsUpdate = true;
    instanceColorAttribute.needsUpdate = true;
  }
};

const scheduleRebuild = () => {
  if (animationId !== undefined) return;
  dirty = true;
  animationId = requestAnimationFrame(() => {
    animationId = undefined;
    if (dirty) {
      dirty = false;
      rebuild();
    }
  });
};

// System to track entities with health
addSystem({
  props: ["health", "maxHealth", "position"],
  onAdd: (e) => {
    if (isDamaged(e)) {
      damagedEntities.add(e);
      scheduleRebuild();
    }
  },
  onChange: (e) => {
    if (isDamaged(e)) {
      damagedEntities.add(e);
      scheduleRebuild();
    } else if (damagedEntities.has(e)) {
      damagedEntities.delete(e);
      scheduleRebuild();
    }
  },
  onRemove: (e) => {
    if (damagedEntities.has(e)) {
      damagedEntities.delete(e);
      scheduleRebuild();
    }
  },
});

// Rebuild when settings change
gameplaySettingsVar.subscribe(scheduleRebuild);
