import { Entity } from "../ecs.ts";
import { AnimatedInstancedMesh } from "../graphics/AnimatedInstancedMesh.ts";
import {
  getAnimationTime,
  updateAnimationTime,
} from "../graphics/AnimatedMeshMaterial.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { collections } from "./models.ts";

// Animation state tracking for AnimatedInstancedMesh models
const entityAnimationState = new WeakMap<Entity, string | undefined>();

// Collections with active blend weights that need per-frame decay
const blendingCollections = new Set<AnimatedInstancedMesh>();

// Track entities with extended cast animation after mirror image
const mirrorCastOverride = new Set<Entity>();
const MIRROR_CAST_EXTENSION_MS = 100;

// Track collections that have had their shader ready callback set up
const shaderReadySetup = new WeakSet<AnimatedInstancedMesh>();

const setupShaderReadyCallback = (collection: AnimatedInstancedMesh) => {
  if (shaderReadySetup.has(collection)) return;
  shaderReadySetup.add(collection);

  collection.onShaderReady = () => {
    // Clear cached animation state for all entities using this collection
    // so animations get re-applied with the now-ready shader
    for (const e of appContext.current.entities) {
      const model = e.model ?? e.prefab;
      if (model && collections[model] === collection) {
        entityAnimationState.delete(e);
        updateAnimationState(e);
      }
    }
  };
};

export const getCurrentAnimation = (e: Entity): string | undefined => {
  const model = e.model ?? e.prefab;
  if (!model) return;

  const collection = collections[model];
  if (!(collection instanceof AnimatedInstancedMesh)) return;

  if (
    e.order && "path" in e.order && e.order.path?.length &&
    collection.getClipInfo("run")
  ) return "run";

  const action = findActionByOrder(e);
  if (
    action && "animation" in action && action.animation &&
    collection.getClipInfo(action.animation)
  ) return action.animation;

  if (e.order?.type === "cast" && collection.getClipInfo("cast")) return "cast";

  if (e.swing) return "attack";

  // Extend cast animation briefly after mirror image cast ends
  if (mirrorCastOverride.has(e) && collection.getClipInfo("cast")) {
    return "cast";
  }

  if (typeof e.progress === "number" && e.progress < 1) return "build";

  return collection.getClipInfo("idle") ? "idle" : undefined;
};

export const computeAnimationParams = (
  animationName: string | undefined,
  collection: AnimatedInstancedMesh,
  e: Entity,
): { phase: number; speed: number } => {
  if (!animationName) return { phase: 0, speed: 0 };
  const clipInfo = collection.getClipInfo(animationName);
  let targetDuration = clipInfo?.duration ?? 1;
  if (animationName === "build" && e.completionTime) {
    targetDuration = e.completionTime * (1 - (e.progress ?? 0));
  }
  const speed = 1 / targetDuration;
  const phase = 1 - ((getAnimationTime() * speed) % 1);
  return { phase, speed };
};

export const FADEABLE_ANIMS = new Set(["idle", "run", "cast"]);

export const updateAnimationState = (e: Entity) => {
  const model = e.model ?? e.prefab;
  if (!model) return;

  const collection = collections[model];
  if (!(collection instanceof AnimatedInstancedMesh)) return;

  setupShaderReadyCallback(collection);

  const animationName = getCurrentAnimation(e);

  const currentAnim = entityAnimationState.get(e);
  if (currentAnim !== animationName) {
    const shouldCrossfade = FADEABLE_ANIMS.has(currentAnim ?? "");
    entityAnimationState.set(e, animationName);
    const { phase, speed } = computeAnimationParams(
      animationName,
      collection,
      e,
    );
    collection.setAnimationAt(
      e.id,
      animationName ?? "default",
      phase,
      speed,
      shouldCrossfade,
    );
    if (shouldCrossfade) blendingCollections.add(collection);
  }
};

const isCastingMirror = (e: Entity) =>
  e.order?.type === "cast" && e.order.orderId === "mirrorImage";

const handleMirrorCastChange = (e: Entity) => {
  if (isCastingMirror(e)) {
    mirrorCastOverride.add(e);
  } else if (mirrorCastOverride.has(e)) {
    // Cast ended - extend animation briefly then clear
    setTimeout(() => {
      if (!isCastingMirror(e)) {
        mirrorCastOverride.delete(e);
        updateAnimationState(e);
      }
    }, MIRROR_CAST_EXTENSION_MS);
  }
  updateAnimationState(e);
};

addSystem({
  props: ["order"],
  onAdd: handleMirrorCastChange,
  onChange: handleMirrorCastChange,
  onRemove: handleMirrorCastChange,
});

addSystem({
  props: ["progress"],
  onAdd: updateAnimationState,
  onChange: updateAnimationState,
  onRemove: updateAnimationState,
});

addSystem({
  props: ["swing"],
  onAdd: updateAnimationState,
  onRemove: updateAnimationState,
});

addSystem({
  props: ["model"],
  onAdd: updateAnimationState,
  onChange: updateAnimationState,
  update: (delta, time) => {
    updateAnimationTime(time);
    for (const col of blendingCollections) {
      if (!col.decayBlendWeights(delta)) blendingCollections.delete(col);
    }
  },
});
