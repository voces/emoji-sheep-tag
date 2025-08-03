import { start } from "../actions/start.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { onInit } from "../ecs.ts";
import { endRound } from "../lobbyApi.ts";
import { message } from "../updates.ts";
import { data } from "./data.ts";

onInit((game) => {
  game.addEventListener("unitDeath", ({ unit, killer }) => {
    if (unit.prefab !== "sheep") return;
    if (killer?.owner && unit.owner) {
      message({
        type: "kill",
        killer: { player: killer.owner, unit: killer.id },
        victim: { player: unit.owner, unit: unit.id },
      });
    }
    if (!data.sheep.some((p) => (p.sheep?.health ?? 0) > 0)) {
      endRound();

      // Auto start
      const lobby = lobbyContext.context;
      setTimeout(() => {
        if (lobby.host) {
          clientContext.with(
            lobby.host,
            () => lobbyContext.with(lobby, () => start(lobby.host!)),
          );
        }
      }, 250);
    }
  });
});
