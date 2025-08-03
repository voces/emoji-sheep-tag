import { addSystem } from "../ecs.ts";

addSystem((game) => ({
  props: ["health"],
  onChange: (e) => {
    if (e.health !== 0) return;
    game.delete(e);
  },
}));
