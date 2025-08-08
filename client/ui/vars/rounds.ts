import { makeVar } from "@/hooks/useVar.tsx";

export const roundsVar = makeVar<
  ReadonlyArray<{
    sheep: ReadonlyArray<string>;
    wolves: ReadonlyArray<string>;
    duration: number;
  }>
>([]);
