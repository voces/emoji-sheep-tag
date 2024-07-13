import { makeVar } from "../hooks/useVar.tsx";

export type Player = {
  id: string;
  name: string;
  color: string;
  local?: boolean;
};

export const playersVar = makeVar<Player[]>([]);

export const getLocalPlayer = () => playersVar().find((p) => p.local);
