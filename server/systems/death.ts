import { onInit } from "../ecs.ts";

onInit((game) => {
  game.addSystem({
    props: ["health"],
    onChange: (e) => {
      if (e.health !== 0) return;
      game.delete(e);
    },
  });
});
