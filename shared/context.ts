import { App, System } from "jsr:@verit/ecs";
import { ContextManager } from "./util/ContextManager.ts";
import { Entity } from "./types.ts";

export const appContext = new ContextManager<App<Entity>>();

const initHooks: ((app: App<Entity>) => void)[] = [];
export const onInit = (fn: (app: App<Entity>) => void) => {
  initHooks.push(fn);
};

export const initApp = (app: App<Entity>) => {
  for (const hook of initHooks) hook(app);
};

export const addSystem = <K extends keyof Entity>(
  systemConfig:
    | Partial<System<Entity, K>>
    | ((game: App<Entity>) => Partial<System<Entity, K>>),
) =>
  onInit((game) =>
    game.addSystem(
      typeof systemConfig === "function"
        ? systemConfig(game)
        : { ...systemConfig },
    )
  );
