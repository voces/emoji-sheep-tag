import { App, System } from "@verit/ecs";
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

export const addSystem = <E extends Entity, K extends keyof E>(
  systemConfig:
    | Partial<System<E, K>>
    | ((game: App<E>) => Partial<System<E, K>>),
) => {
  const trace = new Error("").stack;
  const name = trace?.split("\n")[2]?.trim() || "unknown";
  onInit((game) =>
    Object.assign(
      game.addSystem(
        (typeof systemConfig === "function"
          ? systemConfig(game as unknown as App<E>)
          : { ...systemConfig }) as Partial<System<Entity, keyof Entity>>,
      ),
      { trace, name },
    )
  );
};
