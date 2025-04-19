import { makeVar } from "../hooks/useVar.tsx";

export const roundsVar = makeVar<
  { sheep: string[]; wolves: string[]; duration: number }[]
>([]);
