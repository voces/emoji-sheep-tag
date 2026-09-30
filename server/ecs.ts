import { App, newApp } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { newEntity, remove, update } from "./updates.ts";
import { appContext, initApp } from "@/shared/context.ts";
import { buildDefaultMap, type LoadedMap, setMapForApp } from "@/shared/map.ts";
import { id } from "@/shared/util/id.ts";

export type Game = App<Entity> & {
  tick: number;
};

type Message = () => string;

const withInfo = (message: string, info?: Message) => {
  const detail = info?.();
  return detail ? `${message} ${detail}` : message;
};

export const makeLoopGuard = (
  label: Message,
  warnIters = 100,
  throwIters = 10_000,
) => {
  let i = 0, lastWarn = 0;
  return (progressInfo?: Message) => {
    i++;
    if (i === warnIters || (i > warnIters && i - lastWarn >= warnIters)) {
      lastWarn = i;
      console.warn(
        new Error(withInfo(`[loop-warn] ${label()} i=${i}`, progressInfo)),
      );
    }
    if (i >= throwIters) {
      const msg = withInfo(
        `[loop-infinite] ${label()} exceeded ${throwIters} iterations`,
        progressInfo,
      );
      console.error(msg);
      throw new Error(msg);
    }
  };
};

type LoopGuard = ReturnType<typeof makeLoopGuard>;

const systemName = (system: unknown) =>
  (system as { name?: string }).name || "unknown";

const allPresent = (entity: Entity, props: Iterable<keyof Entity>) => {
  for (const prop of props) if (entity[prop] == null) return false;
  return true;
};

export const newEcs = (map: LoadedMap = buildDefaultMap()) => {
  const initializeEntity = (input: Partial<Entity>) => {
    if (!input.id) input.id = id(input.prefab);
    const entity = input as Entity;

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

  const app = newApp<Entity>({
    initializeEntity,
    flush: () => {
      const guardFlush = makeLoopGuard(() => "flush-outer", 10, 1000);

      // Guards persist across re-queues for the entire flush
      const entityGuards = new Map<Entity, LoopGuard>();
      const changeGuards = new Map<Entity, Map<unknown, LoopGuard>>();

      while (app.callbackQueue.length || app.entityChangeQueue.size) {
        guardFlush(() =>
          `callbacks=${app.callbackQueue.length} entities=${app.entityChangeQueue.size}`
        );

        while (app.entityChangeQueue.size) {
          const [entity, changes] = app.entityChangeQueue.entries().next()
            .value!;

          let guardEntity = entityGuards.get(entity);
          if (!guardEntity) {
            guardEntity = makeLoopGuard(
              () => `flush-entity[${entity.id}]`,
              50,
              500,
            );
            entityGuards.set(entity, guardEntity);
          }

          let systemGuards = changeGuards.get(entity);
          if (!systemGuards) {
            systemGuards = new Map();
            changeGuards.set(entity, systemGuards);
          }

          while (changes.size) {
            const [system, props] = changes.entries().next().value!;

            let guardChange = systemGuards.get(system);
            if (!guardChange) {
              guardChange = makeLoopGuard(
                () => `flush-change[${entity.id}:${systemName(system)}]`,
                50,
                500,
              );
              systemGuards.set(system, guardChange);
            }

            guardEntity(() => `changes=${changes.size}`);
            guardChange(() => `props=[${Array.from(props).join(",")}]`);

            changes.delete(system);

            // Already in the system; either a change or removal
            if (system.entities.has(entity)) {
              // If every modified prop is present, it's a change
              if (
                allPresent(entity, props) &&
                app.entities.has(entity) &&
                app.systems.has(system)
              ) {
                system.onChange?.(entity);
              } else {
                system.entities.delete(entity);
                system.onRemove?.(entity);
              }
            } else if (system.props?.every((p) => entity[p] != null)) {
              // Not in the system; may be an add
              system.entities.add(entity);
              system.onAdd?.(entity);
            }
          }

          app.entityChangeQueue.delete(entity);
        }

        // Drain callbackQueue once per outer cycle (callbacks may enqueue more work)
        if (app.callbackQueue.length) {
          const cb = app.callbackQueue.shift()!;
          cb();
        }
      }

      app.flushScheduled = false;
    },
  }) as Game;

  // Add custom properties and override removeEntity to handle networking
  app.tick = 0;

  const originalRemoveEntity = app.removeEntity.bind(app);
  app.removeEntity = (entity: Entity) => {
    remove(entity);
    return originalRemoveEntity(entity);
  };

  appContext.with(app, () => {
    setMapForApp(app, map);
    initApp();
  });

  return app;
};

import("./api/timing.ts");
import("./systems/clearFlags.ts");
import("./systems/action/action.ts");
import("./systems/actionCooldowns.ts");
import("./systems/auras.ts");
import("./systems/autoAttack.ts");
import("./systems/buffs.ts");
import("./systems/death.ts");
import("./systems/editor.ts");
import("./systems/goldGeneration.ts");
import("./systems/lookup.ts");
import("./systems/tilemapRotation.ts");
import("./systems/pathing.ts");
import("./systems/playerEntities.ts");
import("./systems/practiceMode.ts");
import("./systems/projectile.ts");
import("./systems/queues.ts");
import("./systems/regen.ts");
import("./systems/spiritPen.ts");
import("./systems/autocast.ts");
import("./systems/tickDamage.ts");
import("./systems/sheepTime.ts");
import("./systems/bulldog.ts");
import("@/shared/systems/mapCenterMarker.ts");
import("@/shared/systems/vision.ts");
import("@/shared/dayNight.ts");
import("./orders/index.ts");
