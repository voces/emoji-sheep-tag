import { makeVar } from "../hooks/useVar.tsx";

export type Player = {
  id: string;
  name: string;
  color: string;
  local?: boolean;
  host?: boolean;
};

export const playersVar = makeVar<Player[]>([]);

export const getLocalPlayer = () => playersVar().find((p) => p.local);

export const isLocalPlayer = (player: Player | string) =>
  playersVar().find((p) => p.local)?.id ===
    (typeof player === "string" ? player : player.id);
