import { App, System } from "@verit/ecs";
import { ContextManager } from "./util/ContextManager.ts";
import { Entity } from "./types.ts";

export const appContext = new ContextManager<App<Entity>>();

const initHooks: ((app: App<Entity>) => void)[] = [];
const initialized = new Set<WeakRef<App<Entity>>>();

/**
 * Runs `fn` on every app as it initializes. A hook registered after an app
 * initialized runs on it at once, so the app ends up with every system no
 * matter how module evaluation interleaves with initialization.
 */
export const onInit = (fn: (app: App<Entity>) => void) => {
  initHooks.push(fn);
  for (const ref of initialized) {
    const app = ref.deref();
    if (app) appContext.with(app, () => fn(app));
    else initialized.delete(ref);
  }
};

export const initApp = () => {
  const app = appContext.current;
  initialized.add(new WeakRef(app));
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
