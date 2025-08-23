import { App, newApp, System } from "jsr:@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { newEntity, remove, update } from "./updates.ts";

// Alphanumeric, minus 0, O, l, and I
const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const toBase58 = (num: number): string => {
  let result = "";
  while (num > 0) {
    result = chars[num % 58] + result;
    num = Math.floor(num / 58);
  }
  return result || "1";
};

let counter = 0;
let counterSecond = 0;
const id = (type?: string) => {
  const second = Math.floor(Date.now() / 1000);
  if (counterSecond !== second) {
    counter = 0;
    counterSecond = second;
  }
  try {
    return type
      ? `${type}-1${toBase58(second)}${toBase58(counter)}`
      : `1${toBase58(second)}${toBase58(counter)}`;
  } finally {
    counter++;
  }
};

export type Game = App<Entity> & {
  tick: number;
};

const initHooks: ((game: Game) => void)[] = [];
export const onInit = (fn: (game: Game) => void) => {
  initHooks.push(fn);
};

export const addSystem = <K extends keyof Entity>(
  systemConfig:
    | Partial<System<Entity, K>>
    | ((game: Game) => Partial<System<Entity, K>>),
) =>
  onInit((game) =>
    game.addSystem(
      typeof systemConfig === "function"
        ? systemConfig(game)
        : { ...systemConfig },
    )
  );

export const newEcs = () => {
  const initializeEntity = (input: Partial<Entity>) => {
    const entity: Entity = { ...input, id: input.id || id(input.prefab) };

    const setTrap: ProxyHandler<Entity>["set"] = function setTrap(
      target,
      prop,
      value,
    ) {
      if (!app.flushScheduled) {
        const err = new Error(
          `Setting ${String(prop)} on ${target.id} outside batch`,
        );
        Error.captureStackTrace(err, setTrap);
        console.warn(err);
      }
      if (target[prop as keyof Entity] === value) return true;
      // deno-lint-ignore no-explicit-any
      (target as any)[prop] = value;
      app.queueEntityChange(proxy, prop as keyof Entity);
      update(target.id, prop as keyof Entity, value);
      return true;
    };

    const deleteTrap: ProxyHandler<Entity>["deleteProperty"] =
      function deleteTrap(target, prop) {
        if (!app.flushScheduled) {
          const err = new Error(
            `Deleting ${String(prop)} on ${target.id} outside batch`,
          );
          Error.captureStackTrace(err, deleteTrap);
          console.warn(err);
        }
        if (target[prop as keyof Entity] == null) return true;
        // deno-lint-ignore no-explicit-any
        delete (target as any)[prop];
        app.queueEntityChange(proxy, prop as keyof Entity);
        update(target.id, prop as keyof Entity, null);
        return true;
      };

    const proxy = new Proxy(entity, {
      set: setTrap,
      deleteProperty: deleteTrap,
    });
    newEntity(entity);
    return proxy;
  };

  const app = newApp<Entity>({ initializeEntity }) as Game;

  // Add custom properties and override removeEntity to handle networking
  app.tick = 0;

  const originalRemoveEntity = app.removeEntity.bind(app);
  app.removeEntity = (entity: Entity) => {
    remove(entity.id);
    return originalRemoveEntity(entity);
  };

  for (const hook of initHooks) hook(app);

  return app;
};

import("./systems/action/action.ts");
import("./systems/autoAttack.ts");
import("./systems/death.ts");
import("./systems/kd.ts");
import("./systems/lookup.ts");
import("./systems/lookup.ts");
import("./systems/regen.ts");
import("./systems/pathing.ts");
import("./systems/pathing.ts");
import("./systems/playerEntities.ts");
import("./systems/playerEntities.ts");
import("./systems/queues.ts");
import("./systems/goldGeneration.ts");
import("./systems/buffs.ts");
import("./orders/index.ts");
