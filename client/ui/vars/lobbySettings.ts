import { makeVar } from "@/hooks/useVar.tsx";

export type LobbySettings = {
  startingGold: {
    sheep: number;
    wolves: number;
  };
};

export const lobbySettingsVar = makeVar<LobbySettings>({
  startingGold: { sheep: 0, wolves: 0 },
});
