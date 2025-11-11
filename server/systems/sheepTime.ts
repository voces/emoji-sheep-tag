import { addSystem } from "@/shared/context.ts";
import { lobbyContext } from "../contexts.ts";
import { endRound, send } from "../lobbyApi.ts";
import { colorName } from "@/shared/api/player.ts";

addSystem({
  props: ["isPlayer"],
  updateEntity: (entity, delta) => {
    const lobby = lobbyContext.current;

    if (
      lobby.settings.mode !== "switch" ||
      !lobby.round?.start ||
      entity.team !== "sheep"
    ) return;

    // Increment sheep time by delta
    entity.sheepTime = (entity.sheepTime ?? 0) + delta;

    // Check win condition
    const lobbyTime = lobby.settings.time === "auto"
      ? 120
      : lobby.settings.time;
    if (entity.sheepTime >= lobbyTime) {
      send({ type: "chat", message: `${colorName(entity)} wins!` });
      endRound();
    }
  },
});
