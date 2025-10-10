import { makeVar } from "@/hooks/useVar.tsx";
import { Lobby } from "../../schemas.ts";

export const lobbiesVar = makeVar<ReadonlyArray<Lobby>>([]);
