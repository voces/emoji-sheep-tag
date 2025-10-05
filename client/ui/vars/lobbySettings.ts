import { makeVar } from "@/hooks/useVar.tsx";
import { LobbySettings } from "../../schemas.ts";

export const lobbySettingsVar = makeVar<LobbySettings>({
  sheep: 0,
  autoSheep: true,
  time: 0,
  autoTime: true,
  startingGold: { sheep: 0, wolves: 0 },
  income: { sheep: 1, wolves: 1 },
});
