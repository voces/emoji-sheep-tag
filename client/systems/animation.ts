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

const VARIANT_CHANCE = 0.25;

type VariantState = {
  base: string;
  resolved: string;
  cycleEnd: number;
};

const entityVariants = new WeakMap<Entity, VariantState>();
const variantEntities = new Set<Entity>();

const variantCache = new WeakMap<
  AnimatedInstancedMesh,
  Map<string, string[]>
>();

const getVariants = (
  collection: AnimatedInstancedMesh,
  base: string,
): string[] => {
  let cache = variantCache.get(collection);
  if (!cache) {
    cache = new Map();
    variantCache.set(collection, cache);
  }
  let variants = cache.get(base);
  if (variants) return variants;

  variants = [];
  if (!collection.animationData) return variants;
  for (const name of collection.animationData.clips.keys()) {
    if (
      name !== base && name.startsWith(base) &&
      /^\d+$/.test(name.slice(base.length))
    ) {
      variants.push(name);
    }
  }
  cache.set(base, variants);
  return variants;
};

/** Returns the resolved animation name (including variants) for an entity. */
export const getResolvedAnimation = (e: Entity): string | undefined => {
  const variant = entityVariants.get(e);
  return variant?.resolved ?? entityAnimationState.get(e);
};

const applyAnimation = (
  e: Entity,
  collection: AnimatedInstancedMesh,
  animName: string,
  crossfade: boolean,
) => {
  const { phase, speed } = computeAnimationParams(animName, collection, e);
  collection.setAnimationAt(e.id, animName, phase, speed, crossfade);
  if (crossfade) blendingCollections.add(collection);

  const duration = collection.getClipInfo(animName)?.duration ?? 1;
  const variants = getVariants(collection, entityAnimationState.get(e) ?? "");
  if (variants.length > 0) {
    entityVariants.set(e, {
      base: entityAnimationState.get(e) ?? animName,
      resolved: animName,
      cycleEnd: getAnimationTime() + duration,
    });
    variantEntities.add(e);
  } else {
    entityVariants.delete(e);
    variantEntities.delete(e);
  }
};

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
    applyAnimation(e, collection, animationName ?? "default", shouldCrossfade);
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
  update: (delta) => {
    updateAnimationTime(delta);
    for (const col of blendingCollections) {
      if (!col.decayBlendWeights(delta)) blendingCollections.delete(col);
    }
    for (const e of variantEntities) {
      const v = entityVariants.get(e);
      if (!v || getAnimationTime() < v.cycleEnd) continue;
      if (entityAnimationState.get(e) !== v.base) {
        variantEntities.delete(e);
        entityVariants.delete(e);
        continue;
      }
      const model = e.model ?? e.prefab;
      if (!model) continue;
      const collection = collections[model];
      if (!(collection instanceof AnimatedInstancedMesh)) continue;
      const variants = getVariants(collection, v.base);
      const isVariant = v.resolved !== v.base;
      const next = isVariant || Math.random() > VARIANT_CHANCE
        ? v.base
        : variants[Math.floor(Math.random() * variants.length)];
      applyAnimation(e, collection, next, FADEABLE_ANIMS.has(v.base));
    }
  },
});
