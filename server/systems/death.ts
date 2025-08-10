import { addSystem } from "../ecs.ts";
import { data } from "../st/data.ts";
import { endRound } from "../lobbyApi.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { start } from "../actions/start.ts";
import { timeout } from "../api/timing.ts";

addSystem((game) => ({
  props: ["health"],
  onChange: (unit) => {
    if (unit.health > 0) return;

    if (
      unit.prefab === "sheep" &&
      !data.sheep.some((p) => (p.sheep?.health ?? 0) > 0)
    ) {
      timeout(() => {
        endRound();

        console.log("kill!");

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
      }, 0.05);
    }

    game.delete(unit);
  },
}));
