import { onInit } from "../ecs.ts";

onInit((game) => {
  game.addEventListener("unitDeath", (e) => game.delete(e.unit));
});
