import { Color } from "three";

import { app, Entity, SystemEntity } from "../ecs.ts";
import { InstancedSvg } from "../graphics/InstancedSvg.ts";
import { AnimatedInstancedMesh } from "../graphics/AnimatedInstancedMesh.ts";
import { getLocalPlayer } from "../api/player.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { getFps } from "../graphics/three.ts";
import { computeUnitMovementSpeed, isAlly } from "@/shared/api/unit.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { collections, svgs } from "./models.ts";
import { getCurrentAnimation, updateAnimationState } from "./animation.ts";

export { collections, svgs };

const isVisibleToLocalPlayer = (e: Entity) => {
  if (e.hiddenByFog) return false;
  if (!e.teamScoped) return true;
  const l = getLocalPlayer()?.id;
  if (!l) return true;
  return isAlly(e, l);
};

const color = new Color();

const updateColor = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  const model = e.model ?? e.prefab;
  if (!model) return;
  const collection = collections[model];
  if (!collection) return;

  if (typeof e.vertexColor === "number") {
    color.setHex(e.vertexColor);
    collection.setVertexColorAt(e.id, color);
  } else {
    color.setHex(0xffffff);
    collection.setVertexColorAt(e.id, color);
  }

  const accentColor = e.playerColor ?? getPlayer(e.owner)?.playerColor;

  if (accentColor) {
    collection.setPlayerColorAt(e.id, color.set(accentColor ?? 0xffffff));
  }

  if (e.alpha) collection.setAlphaAt(e.id, e.alpha, false);
  else if (
    typeof e.progress === "number" && collection instanceof InstancedSvg
  ) {
    collection.setAlphaAt(e.id, e.progress, true);
  } else collection.setAlphaAt(e.id, 1);
};

addSystem({
  props: ["owner"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

addSystem({
  props: ["vertexColor"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

addSystem({
  props: ["alpha"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

addSystem({
  props: ["playerColor"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

const prevPositions = new WeakMap<Entity, Entity["position"]>();
const gaitProgress = new WeakMap<Entity, number>();
const pathStartPositions = new WeakMap<Entity, { x: number; y: number }>();

const onPositionOrRotationChange = (
  e: SystemEntity<"position"> & {
    readonly facing?: number | null;
  },
) => {
  const model = e.model ?? e.prefab;
  if (!model) return;

  if (!isVisibleToLocalPlayer(e)) {
    return collections[model]?.setPositionAt(
      e.id,
      Infinity,
      Infinity,
      e.facing,
      e.zIndex,
    );
  }

  let baseX = e.position.x;
  let baseY = e.position.y;

  if (e.order && "path" in e.order) {
    const prev = prevPositions.get(e);
    if (prev) {
      const delta =
        ((prev.x - e.position.x) ** 2 + (prev.y - e.position.y) ** 2) ** 0.5;
      const movement = computeUnitMovementSpeed(e) / getFps();
      const jerk = delta / movement;

      if (jerk > 1.05 && jerk < 15) {
        const angle = Math.atan2(
          e.position.y - prev.y,
          e.position.x - prev.x,
        );
        const dist = movement * 1.05;
        baseX = prev.x + dist * Math.cos(angle);
        baseY = prev.y + dist * Math.sin(angle);
        prevPositions.set(e, { x: baseX, y: baseY });
      } else {
        prevPositions.set(e, e.position);
      }
    } else {
      prevPositions.set(e, e.position);
    }
  } else {
    prevPositions.set(e, e.position);
  }

  let finalX = baseX;
  let finalY = baseY;

  // Skip gait for AnimatedInstancedMesh - it has GPU-driven animation
  const collection = collections[model];

  if (e.gait && e.order && "path" in e.order && e.movementSpeed) {
    const path = e.order.path;
    if (!path || path.length === 0) {
      gaitProgress.delete(e);
      pathStartPositions.delete(e);
    } else {
      if (!pathStartPositions.has(e)) {
        pathStartPositions.set(e, { x: e.position.x, y: e.position.y });
      }

      const dt = 1 / getFps();
      const currentProgress = gaitProgress.get(e) ?? 0;
      const newProgress = (currentProgress + dt) % e.gait.duration;
      gaitProgress.set(e, newProgress);

      const t = (newProgress / e.gait.duration) * Math.PI * 2;
      const distancePerCycle = e.movementSpeed * e.gait.duration;

      let offsetX = 0;
      let offsetY = 0;

      for (const component of e.gait.components) {
        const angle = component.frequency * t + component.phase;
        offsetX += component.radiusX * distancePerCycle * Math.cos(angle);
        offsetY += component.radiusY * distancePerCycle * Math.sin(angle);
      }

      const fadeDistance = 0.5;
      const startPos = pathStartPositions.get(e)!;
      const distFromStart = ((e.position.x - startPos.x) ** 2 +
        (e.position.y - startPos.y) ** 2) ** 0.5;
      const endPos = path[path.length - 1];
      const distToEnd = ((e.position.x - endPos.x) ** 2 +
        (e.position.y - endPos.y) ** 2) ** 0.5;

      const fadeInMultiplier = Math.min(1, distFromStart / fadeDistance);
      const fadeOutMultiplier = Math.min(1, distToEnd / fadeDistance);
      const fadeMultiplier = Math.min(fadeInMultiplier, fadeOutMultiplier);

      offsetX *= fadeMultiplier;
      offsetY *= fadeMultiplier;

      const heading = e.facing ?? 0;
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);

      finalX = baseX + offsetX * cos - offsetY * sin;
      finalY = baseY + offsetX * sin + offsetY * cos;
    }
  } else {
    gaitProgress.delete(e);
    pathStartPositions.delete(e);
  }

  collection?.setPositionAt(
    e.id,
    finalX,
    finalY,
    e.facing,
    e.zIndex,
  );
};

const handleFog = (e: Entity) =>
  e.position && onPositionOrRotationChange(e as SystemEntity<"position">);
addSystem({
  props: ["hiddenByFog"],
  onAdd: handleFog,
  onChange: handleFog,
  onRemove: handleFog,
});

addSystem({
  props: ["facing"],
  onChange: (e) => {
    if (e.position) {
      onPositionOrRotationChange(
        e as SystemEntity<"position" | "facing">,
      );
    }
  },
});

const updateScale = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  const model = e.model ?? e.prefab;
  if (!model) return;
  const collection = collections[model];
  if (!collection) return console.warn(`No ${e.model} SVG on ${e.id}`);
  collection.setScaleAt(e.id, e.modelScale ?? 1, e.aspectRatio);
};
addSystem({
  props: ["modelScale"],
  onAdd: updateScale,
  onChange: updateScale,
  onRemove: updateScale,
});
addSystem({
  props: ["aspectRatio"],
  onAdd: updateScale,
  onChange: updateScale,
  onRemove: updateScale,
});

addSystem({
  props: ["progress", "completionTime"],
  updateEntity: (e, delta) => {
    if (e.progress + delta >= 1) {
      return delete (e as Entity).progress;
    }
    e.progress += delta / e.completionTime;
  },
});

const updateAlpha = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  const collection = collections[e.model ?? e.prefab ?? ""];
  if (!collection || collection instanceof AnimatedInstancedMesh) return;
  collection.setAlphaAt(
    e.id,
    typeof e.progress === "number" ? e.progress : 1,
    typeof e.progress === "number",
  );
};
addSystem({
  props: ["progress"],
  onAdd: updateAlpha,
  onChange: updateAlpha,
  onRemove: updateAlpha,
});

const wasCastingMirror = new Map<Entity, number>();

addSystem<Entity, "order" | "position">({
  props: ["order", "position"],
  onChange: (e) => {
    if (e.order.type === "cast" && e.order.orderId === "mirrorImage") {
      wasCastingMirror.set(e, e.order.remaining + 0.15);
    }
  },
  updateEntity: (e) => {
    const model = e.model ?? e.prefab;
    if (
      !model || e.order.type !== "cast" || "path" in e.order ||
      e.order.remaining === 0
    ) return;

    // Skip jitter effect if model supports a custom animation for this action
    if (getCurrentAnimation(e)) return;

    if (!isVisibleToLocalPlayer(e)) {
      return collections[model]?.setPositionAt(
        e.id,
        Infinity,
        Infinity,
        e.facing,
        e.zIndex,
      );
    }

    const r = Math.random() * Math.PI * 2;
    collections[model]?.setPositionAt(
      e.id,
      e.position.x + 0.05 * Math.cos(r),
      e.position.y + 0.05 * Math.sin(r),
      e.facing,
      e.zIndex,
    );
  },
  update: (delta) => {
    for (const [e, remaining] of wasCastingMirror) {
      const model = e.model ?? e.prefab;
      if (!model || !e.position || !app.entities.has(e)) {
        wasCastingMirror.delete(e);
        continue;
      }

      if (!isVisibleToLocalPlayer(e)) {
        collections[model]?.setPositionAt(
          e.id,
          Infinity,
          Infinity,
          e.facing,
          e.zIndex,
        );
        wasCastingMirror.delete(e);
        continue;
      }

      if ((remaining ?? 0) < delta) wasCastingMirror.delete(e);
      else wasCastingMirror.set(e, remaining - delta);

      const r = Math.random() * Math.PI * 2;
      collections[model]?.setPositionAt(
        e.id,
        e.position.x + 0.05 * Math.cos(r),
        e.position.y + 0.05 * Math.sin(r),
        e.facing,
        e.zIndex,
      );
    }
  },
});

// Reflect logical position to render position
addSystem({
  props: ["position"],
  onAdd: (e) => {
    prevPositions.set(e, e.position);
    const model = e.model ?? e.prefab;
    if (!model) return;
    if (!collections[model]) {
      return console.warn(`No ${e.model} SVG on ${e.id}`);
    }

    if (!isVisibleToLocalPlayer(e)) {
      return collections[model]?.setPositionAt(
        e.id,
        Infinity,
        Infinity,
        e.facing,
        e.zIndex,
      );
    }

    collections[model]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
      e.facing,
      e.zIndex,
    );
  },
  onChange: onPositionOrRotationChange,
  onRemove: (e) => collections[e.model ?? e.prefab!]?.delete(e.id),
});

const prevModel = new WeakMap<Entity, string>();
addSystem({
  props: ["prefab"],
  onAdd: (e) => {
    const collection = e.model ?? e.prefab;
    if (collection) prevModel.set(e, collection);
    updateAnimationState(e);
  },
  onChange: (e) => {
    const next = e.model ?? e.prefab;
    const prev = prevModel.get(e);
    if (prev !== next) {
      collections[prev ?? ""]?.delete(e.id);
      prevModel.set(e, next);
      if (e.position) onPositionOrRotationChange(e as SystemEntity<"position">);
      updateColor(e);
      updateAnimationState(e);
    }
  },
  onRemove: (e) => {
    const collection = e.model ?? e.prefab;
    if (!collection) prevModel.delete(e);
  },
});
addSystem({
  props: ["model"],
  onAdd: (e) => {
    const collection = e.model ?? e.prefab;
    if (collection) prevModel.set(e, collection);
  },
  onChange: (e) => {
    const next = e.model ?? e.prefab;
    const prev = prevModel.get(e);
    if (prev !== next) {
      collections[prev ?? ""]?.delete(e.id);
      prevModel.set(e, next);
      if (e.position) onPositionOrRotationChange(e as SystemEntity<"position">);
      updateColor(e);
    }
  },
  onRemove: (e) => {
    const collection = e.model ?? e.prefab;
    if (!collection) prevModel.delete(e);
  },
});

const minimapColor = new Color();
const savedColors = new Map<string, Color | null>();

export const setMinimapMask = (entity: Entity, mask: boolean) => {
  const collection = entity.model ?? entity.prefab;
  if (!collection) return;
  const group = collections[collection];
  if (!group) return;

  group.setMinimapMaskAt(entity.id, mask ? 1 : 0);

  const playerColor = entity.playerColor ??
    getPlayer(entity.owner)?.playerColor;
  if (!playerColor) return;

  if (mask) {
    savedColors.set(entity.id, group.saveInstanceColors(entity.id));
    group.setVertexColorAt(entity.id, minimapColor.set(playerColor));
  } else {
    const colorArray = savedColors.get(entity.id);
    if (colorArray) {
      group.restoreInstanceColors(entity.id, colorArray);
      savedColors.delete(entity.id);
    }
  }
};

export const clearMinimapMaskCache = () => {
  savedColors.clear();
};
