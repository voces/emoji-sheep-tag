import { makeVar } from "@/hooks/useVar.tsx";
import { getStoredPlayerName } from "../../util/playerPrefs.ts";

export const playerNameVar = makeVar(getStoredPlayerName() ?? "");
