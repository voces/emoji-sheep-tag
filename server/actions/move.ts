import { distanceBetweenPoints, Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { orderMove } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { isPractice } from "../api/st.ts";
import { getPenAreas } from "@/shared/penAreas.ts";
import { lobbyContext } from "../contexts.ts";
import { getMap } from "@/shared/map.ts";

const MAX_DISTANCE_FROM_PEN = 1.5;

/** Clamp a point to be within valid sheep spawn areas (near pen edges) */
const clampToSpawnArea = (x: number, y: number): { x: number; y: number } => {
  const penAreas = getPenAreas();
  if (penAreas.length === 0) return { x, y };

  // Find the closest point on any pen's expanded boundary
  let closestPoint = { x, y };
  let closestDistance = Infinity;

  for (const pen of penAreas) {
    // Expand pen by MAX_DISTANCE_FROM_PEN to get valid spawn area
    const expandedPen = {
      minX: pen.x - MAX_DISTANCE_FROM_PEN,
      maxX: pen.x + pen.width + MAX_DISTANCE_FROM_PEN,
      minY: pen.y - MAX_DISTANCE_FROM_PEN,
      maxY: pen.y + pen.height + MAX_DISTANCE_FROM_PEN,
    };

    // Clamp point to expanded pen bounds
    const clampedX = Math.max(expandedPen.minX, Math.min(expandedPen.maxX, x));
    const clampedY = Math.max(expandedPen.minY, Math.min(expandedPen.maxY, y));

    const dist = (clampedX - x) ** 2 + (clampedY - y) ** 2;
    if (dist < closestDistance) {
      closestDistance = dist;
      closestPoint = { x: clampedX, y: clampedY };
    }
  }

  return closestPoint;
};

export const handleMove = (
  unit: Entity,
  orderTarget: string | Point | undefined,
  queue = false,
) => {
  if (!unit.position || !orderTarget) return;

  // Interrupt only if not queuing
  if (!queue) {
    delete unit.order;
    delete unit.queue;
  }

  const target = typeof orderTarget === "string"
    ? lookup(orderTarget)
    : orderTarget;
  if (!target) return;

  // Start locations teleport instantly, bounded by sheep spawn area
  if (unit.prefab === "startLocation" && !queue) {
    const targetPosition = "x" in target ? target : target.position;
    if (targetPosition) {
      const clampedPos = clampToSpawnArea(targetPosition.x, targetPosition.y);
      unit.position = clampedPos;

      // Persist position to the owning client for next round
      if (unit.owner) {
        const lobby = lobbyContext.current;
        const mapId = getMap().id;
        const startLocation = { x: clampedPos.x, y: clampedPos.y, map: mapId };
        // ShardLobby uses clients Map, Lobby uses players Set
        const client = "clients" in lobby
          ? (lobby.clients as Map<
            string,
            { startLocation?: { x: number; y: number; map: string } }
          >).get(unit.owner)
          : Array.from(lobby.players).find((p) => p.id === unit.owner);
        if (client) {
          client.startLocation = startLocation;
          // On shard, notify primary server of the update
          if ("onStartLocationUpdate" in lobby) {
            (lobby.onStartLocationUpdate as (
              playerId: string,
              loc: typeof startLocation,
            ) => void)?.(unit.owner, startLocation);
          }
        }
      }
      return;
    }
  }

  if (isPractice() && unit.position && !queue) {
    const targetPosition = "x" in target ? target : target.position;
    if (
      targetPosition &&
      distanceBetweenPoints(unit.position, targetPosition) > 20
    ) {
      unit.position = { x: targetPosition.x, y: targetPosition.y };
      return;
    }
  }

  orderMove(unit, target, queue);
};
