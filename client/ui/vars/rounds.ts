import { makeVar } from "@/hooks/useVar.tsx";
import type { Round } from "@/shared/round.ts";

export const roundsVar = makeVar<ReadonlyArray<Round>>([]);
