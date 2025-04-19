import { makeVar } from "../hooks/useVar.tsx";

export type Player = {
  id: string;
  name: string;
  color: string;
  local?: boolean;
  host?: boolean;
  sheepCount: number;
};

export const playersVar = makeVar<Player[]>([]);
Object.assign(globalThis, { playersVar });

export const getLocalPlayer = () => playersVar().find((p) => p.local);

export const isLocalPlayer = (player: Player | string) =>
  playersVar().find((p) => p.local)?.id ===
    (typeof player === "string" ? player : player.id);
