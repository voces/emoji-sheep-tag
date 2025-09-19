import { App, newApp } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { newEntity, remove, update } from "./updates.ts";
import { initApp } from "@/shared/context.ts";
import { id } from "@/shared/util/id.ts";

export type Game = App<Entity> & {
  tick: number;
};

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
    remove(entity);
    return originalRemoveEntity(entity);
  };

  initApp(app);

  return app;
};

import("./systems/clearFlags.ts");

import("./systems/action/action.ts");
import("./systems/autoAttack.ts");
import("./systems/buffs.ts");
import("./systems/death.ts");
import("./systems/editor.ts");
import("./systems/goldGeneration.ts");
import("./systems/kd.ts");
import("./systems/lookup.ts");
import("./systems/lookup.ts");
import("./systems/pathing.ts");
import("./systems/pathing.ts");
import("./systems/playerEntities.ts");
import("./systems/playerEntities.ts");
import("./systems/queues.ts");
import("./systems/regen.ts");
import("./orders/index.ts");
