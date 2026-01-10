import { Point } from "@/shared/pathing/math.ts";
import { app, Entity } from "../ecs.ts";
import { flags } from "../flags.ts";

const WAYPOINT_SIZE = 0.5;
const SEGMENT_WIDTH = 0.02;
const CIRCLE_RADIUS = WAYPOINT_SIZE * 0.08 * 3.5; // rendered circle radius in world units

const debugPathsMap = new Map<Entity, Map<string, Entity>>();

export const clearDebugCircles = (e: Entity) => {
  const prev = debugPathsMap.get(e);
  if (prev) {
    for (const [, e2] of prev) app.removeEntity(e2);
    debugPathsMap.delete(e);
  }
};

type Spec = {
  position: Point;
  modelScale: number;
  facing?: number;
  aspectRatio?: number;
  prefab: "circle" | "square";
  vertexColor?: number;
};

export const updateDebugCircles = (e: Entity) => {
  if (
    !flags.debug || !flags.debugPathing || !e.position || !e.order ||
    !("path" in e.order) || !e.order.path?.length ||
    e.type === "cosmetic"
  ) return clearDebugCircles(e);

  // 1) build the new set of "keys" and record their specs
  const newKeys = new Set<string>();
  const specs = new Map<string, Spec>();

  // helper to register one marker
  const register = (key: string, spec: Spec) => {
    newKeys.add(key);
    specs.set(key, spec);
  };

  // start‐point circle
  register(`start`, {
    position: e.position,
    modelScale: WAYPOINT_SIZE,
    prefab: "circle",
  });

  // each path point + segment rectangle
  for (let i = e.order.path.length - 1; i >= 0; i--) {
    const p = e.order.path[i];
    // register the node circle
    register(`node-${i}`, {
      position: p,
      modelScale: WAYPOINT_SIZE,
      prefab: "circle",
    });

    // figure out the start of this segment
    const prev = i === 0 ? e.position : e.order.path[i - 1];

    // compute dx, dy, distance, and angle
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    const dist = Math.hypot(dx, dy);
    // shrink segment to not overlap with circles at each end
    const segmentDist = dist - CIRCLE_RADIUS * 2;
    if (segmentDist < 0.01) continue;

    const angle = Math.atan2(dy, dx);
    const midpoint = {
      x: (prev.x + p.x) / 2,
      y: (prev.y + p.y) / 2,
    };

    // register a rectangle for this segment
    register(`seg-${i}`, {
      position: midpoint,
      modelScale: segmentDist,
      prefab: "square",
      facing: angle,
      aspectRatio: SEGMENT_WIDTH / segmentDist,
    });
  }

  // 2) grab (or init) the old map
  let keyToId = debugPathsMap.get(e);
  if (!keyToId) {
    keyToId = new Map();
    debugPathsMap.set(e, keyToId);
  }

  // 3) remove stale markers
  for (const [key, id] of keyToId) {
    if (!newKeys.has(key)) {
      app.removeEntity(id);
      keyToId.delete(key);
    }
  }

  // 4) add or update markers
  const playerColor = e.order.type === "attack" || e.order.type === "attackMove"
    ? "#FF0000"
    : e.order.type === "build"
    ? "#0000FF"
    : "#FFFFFF";
  const vertexColor = e.order.type === "attack" || e.order.type === "attackMove"
    ? 0xFF0000
    : e.order.type === "build"
    ? 0x0000FF
    : 0xFFFFFF;

  for (const key of newKeys) {
    const { position, modelScale, prefab, facing, aspectRatio } = specs.get(
      key,
    )!;
    const existing = keyToId.get(key);

    if (existing) {
      // Update existing entity
      existing.position = position;
      existing.modelScale = modelScale;
      existing.playerColor = playerColor;
      existing.vertexColor = vertexColor;
      if (facing !== undefined) existing.facing = facing;
      if (aspectRatio !== undefined) existing.aspectRatio = aspectRatio;
    } else {
      // Create new entity
      const e2 = app.addEntity({
        id: crypto.randomUUID(),
        prefab,
        position,
        modelScale,
        playerColor,
        vertexColor,
        isDoodad: true,
        type: "cosmetic",
        ...(facing !== undefined && { facing }),
        ...(aspectRatio !== undefined && { aspectRatio }),
      });
      keyToId.set(key, e2);
    }
  }
};
