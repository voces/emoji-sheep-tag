import { Point } from "../../shared/pathing/math.ts";
import { app, Entity } from "../ecs.ts";
import { flags } from "../flags.ts";

const WAYPOINT_SIZE = 0.5;
const STEP_SIZE = 0.1;

const debugPathsMap = new Map<Entity, Map<string, Entity>>();

export const clearDebugCircles = (e: Entity) => {
  const prev = debugPathsMap.get(e);
  if (prev) {
    for (const [, e2] of prev) app.removeEntity(e2);
    debugPathsMap.delete(e);
  }
};

export const updateDebugCircles = (e: Entity) => {
  if (
    !flags.debugPathing || !e.position || !e.action || !("path" in e.action) ||
    !e.action.path?.length
  ) {
    return clearDebugCircles(e);
  }

  // 1) build the new set of “keys” and record their specs
  const newKeys = new Set<string>();
  const specs = new Map<string, { position: Point; modelScale: number }>();

  // helper to register one circle
  const register = (key: string, pos: Point, scale: number) => {
    newKeys.add(key);
    specs.set(key, { position: pos, modelScale: scale });
  };

  // start‐point circle
  register(`${e.position.x}-${e.position.y}`, e.position, WAYPOINT_SIZE);

  // each path point + interpolated steps
  for (let i = e.action.path.length - 1; i >= 0; i--) {
    const p = e.action.path[i];
    // register the node itself
    register(`${p.x}-${p.y}`, p, WAYPOINT_SIZE);

    // figure out the start of this segment
    const prev = i === 0 ? e.position : e.action.path[i - 1];

    // compute dx, dy, distance, and a single, stable angle
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // number of little circles along this segment
    const steps = Math.floor(dist / STEP_SIZE);

    for (let j = 1; j < steps; j++) {
      const len = j * STEP_SIZE;
      const pos = {
        x: p.x - Math.cos(angle) * len,
        y: p.y - Math.sin(angle) * len,
      };
      // stable key per segment+step
      register(`${pos.x}-${pos.y}`, pos, STEP_SIZE * 2);
    }
  }

  // 2) grab (or init) the old map
  let keyToId = debugPathsMap.get(e);
  if (!keyToId) {
    keyToId = new Map();
    debugPathsMap.set(e, keyToId);
  }

  // 3) remove stale circles
  for (const [key, id] of keyToId) {
    if (!newKeys.has(key)) {
      app.removeEntity(id);
      keyToId.delete(key);
    }
  }

  // 4) add any brand‑new circles
  for (const key of newKeys) {
    if (!keyToId.has(key)) {
      const { position, modelScale } = specs.get(key)!;
      const e2 = app.addEntity({
        id: crypto.randomUUID(),
        unitType: "circle",
        position,
        modelScale,
        playerColor:
          e.action.type === "attack" || e.action.type === "attackMove"
            ? "#FF0000"
            : e.action.type === "build"
            ? "#0000FF"
            : "#FFFFFF",
      });
      keyToId.set(key, e2);
    }
  }
};
