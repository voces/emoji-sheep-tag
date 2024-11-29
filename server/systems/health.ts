import { Game, UnitDeathEvent } from "../ecs.ts";

export const addHealthSystem = (app: Game) => {
  app.addSystem({
    props: ["health"],
    onChange: (e) => {
    },
  });
};
