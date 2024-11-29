import { start } from "../actions/start.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { onInit } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { data } from "./data.ts";

onInit((game) => {
  game.addEventListener("unitDeath", ({ unit, killer }) => {
    console.log(`${killer.owner} killed ${unit.owner}`);
    if (!data.sheep.some((p) => (p.sheep?.health ?? 0) > 0)) {
      const lobby = lobbyContext.context;
      lobby.round = undefined;
      lobby.status = "lobby";
      send({ type: "stop" });
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
