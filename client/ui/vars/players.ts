import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import type { Entity } from "@/shared/types.ts";
import type { Team } from "@/shared/zod.ts";

export type Player = {
  id: string;
  name: string;
  color: string;
  team?: Team;
  local?: boolean;
  host?: boolean;
  sheepCount: number;
  entity?: Entity;
};

export const playersVar = makeVar<ReadonlyArray<Player>>([]);
Object.assign(globalThis, { playersVar });

export const getLocalPlayer = () => playersVar().find((p) => p.local);

export const useLocalPlayer = () =>
  useReactiveVar(playersVar).find((p) => p.local);

export const isLocalPlayer = (player: Player | string) =>
  playersVar().find((p) => p.local)?.id ===
    (typeof player === "string" ? player : player.id);

export const getPlayer = (playerId: string) =>
  playersVar().find((p) => p.id === playerId);
