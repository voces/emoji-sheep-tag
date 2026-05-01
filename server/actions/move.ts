import { distanceBetweenPoints, Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { orderMove } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { isPractice } from "../api/st.ts";
import { lobbyContext } from "../contexts.ts";
import { getMap } from "@/shared/map.ts";
import { clampToSheepSpawnArea } from "../st/getSheepSpawn.ts";

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
      const clampedPos = clampToSheepSpawnArea(
        targetPosition.x,
        targetPosition.y,
      );
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
