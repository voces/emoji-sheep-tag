import { start } from "../actions/start.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { onInit } from "../ecs.ts";
import { endRound, send } from "../lobbyApi.ts";
import { data } from "./data.ts";

onInit((game) => {
  // TODO: consume `killer` to add stats?
  game.addEventListener("unitDeath", ({ unit }) => {
    if (unit.unitType !== "sheep") return;
    if (!data.sheep.some((p) => (p.sheep?.health ?? 0) > 0)) {
      endRound();
      send({ type: "stop" });

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
