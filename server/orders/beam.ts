import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { damageEntity } from "../api/unit.ts";
import { getEntitiesInRect } from "@/shared/systems/kd.ts";
import { lookup } from "../systems/lookup.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { testClassification } from "@/shared/api/unit.ts";
import { newSfx } from "../api/sfx.ts";
import { Point } from "@/shared/pathing/math.ts";
import { addSystem } from "@/shared/context.ts";
import { getPlayer } from "@/shared/api/player.ts";

const BEAM_LENGTH = 6;
const BEAM_START_WIDTH = 1;
const BEAM_END_WIDTH = 2;
const BEAM_DURATION = 0.2;
const BEAM_TICK_DAMAGE = 80;

type BeamState = {
  casterId: string;
  angle: number;
  remainingTicks: number;
};

const activeBeams = new Set<BeamState>();

const isInFrustum = (
  start: Point,
  angle: number,
  length: number,
  startWidth: number,
  endWidth: number,
  test: Point,
): boolean => {
  // Direction vector from angle
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // Vector from start to test point
  const toPx = test.x - start.x;
  const toPy = test.y - start.y;

  // Project point onto beam direction
  const projection = toPx * dirX + toPy * dirY;

  // Check if point is within the length of the beam
  if (projection < 0 || projection > length) return false;

  // Calculate perpendicular distance from beam centerline
  const perpDistance = Math.abs(toPx * dirY - toPy * dirX);

  // Interpolate width based on position along beam (0 = start, 1 = end)
  const t = projection / length;
  const widthAtPoint = startWidth * (1 - t) + endWidth * t;

  return perpDistance <= widthAtPoint / 2;
};

export const beamOrder = {
  id: "beam",

  onIssue: (unit, target, queue) => {
    if (typeof target === "string") target = lookup(target)?.position;
    if (!target || !unit.position) return "failed";

    const action = findActionByOrder(unit, "beam");
    if (!action) return "failed";

    const castDuration = "castDuration" in action
      ? action.castDuration ?? 0
      : 0;

    const order: Order = {
      type: "cast",
      orderId: "beam",
      remaining: castDuration,
      target,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastStart: (unit) => {
    if (
      !unit.position || unit.order?.type !== "cast" ||
      unit.order.orderId !== "beam" || !unit.order.target
    ) return;

    const dx = unit.position.x - unit.order.target.x;
    const dy = unit.position.y - unit.order.target.y;
    const angle = Math.atan2(dy, dx);

    newSfx(
      { x: unit.position.x, y: unit.position.y },
      "beamStart",
      angle,
      unit.order.remaining,
      "ease-in",
      undefined,
      {
        sounds: { "birth": ["charging1"] },
        playerColor: unit.playerColor ?? getPlayer(unit.owner)?.playerColor,
      },
    );
  },

  onCastComplete: (unit) => {
    if (unit.order?.type !== "cast" || unit.order.orderId !== "beam") return;

    const target = unit.order.target;
    if (!target || !unit.position) {
      return console.warn("Either no target or position for beam");
    }

    const action = findActionByOrder(unit, "beam");
    if (!action) return console.warn("No beam action");

    // Calculate facing angle
    const dx = target.x - unit.position.x;
    const dy = target.y - unit.position.y;
    const angle = Math.atan2(dy, dx);

    // Store beam state for tick-based damage
    activeBeams.add({
      casterId: unit.id,
      angle,
      remainingTicks: 4,
    });

    // Create beam visual effect
    newSfx(
      { x: unit.position.x, y: unit.position.y },
      "beam",
      angle,
      BEAM_DURATION,
      "ease-in",
      undefined,
      {
        sounds: { "birth": ["laser1"] },
        playerColor: unit.playerColor ?? getPlayer(unit.owner)?.playerColor,
      },
    );
  },
} satisfies OrderDefinition;

const updateBeams = () => {
  const beamsToRemove: BeamState[] = [];

  for (const state of activeBeams) {
    const caster = lookup(state.casterId);
    if (!caster?.position) {
      beamsToRemove.push(state);
      continue;
    }

    // Calculate bounding box for the frustum
    // Get the endpoint of the beam
    const endX = caster.position.x + Math.cos(state.angle) * BEAM_LENGTH;
    const endY = caster.position.y + Math.sin(state.angle) * BEAM_LENGTH;

    // Use the larger width (startWidth) as padding since frustum tapers
    const padding = Math.max(BEAM_START_WIDTH, BEAM_END_WIDTH);
    const minX = Math.min(caster.position.x, endX) - padding;
    const maxX = Math.max(caster.position.x, endX) + padding;
    const minY = Math.min(caster.position.y, endY) - padding;
    const maxY = Math.max(caster.position.y, endY) + padding;

    const entities = getEntitiesInRect(minX, minY, maxX, maxY);

    for (const entity of entities) {
      if (!entity.position) continue;
      if (entity.id === state.casterId) continue;
      if (!entity.health || entity.health <= 0) continue;

      // Check if entity is a structure
      if (!testClassification(caster, entity, [["structure"]])) continue;

      // Check if entity is within frustum
      if (
        !isInFrustum(
          caster.position,
          state.angle,
          BEAM_LENGTH,
          BEAM_START_WIDTH,
          BEAM_END_WIDTH,
          entity.position,
        )
      ) continue;

      // Deal damage and mark as damaged
      damageEntity(caster, entity, BEAM_TICK_DAMAGE, false);
    }

    if (state.remainingTicks === 1) beamsToRemove.push(state);
    else state.remainingTicks--;
  }

  for (const state of beamsToRemove) activeBeams.delete(state);
};

// Register system to update beam damage every tick
addSystem({ update: updateBeams });
