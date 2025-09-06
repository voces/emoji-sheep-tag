import { makeVar } from "@/hooks/useVar.tsx";
import { LobbySettings } from "../../schemas.ts";

export const lobbySettingsVar = makeVar<LobbySettings>({
  sheep: 0,
  time: 0,
  autoTime: true,
  startingGold: { sheep: 0, wolves: 0 },
});
