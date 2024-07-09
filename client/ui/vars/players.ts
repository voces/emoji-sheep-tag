import { makeVar } from "../hooks/useVar.tsx";

export type Player = {
  id: string;
  name: string;
  color: string;
};

export const playersVar = makeVar<Player[]>([]);
