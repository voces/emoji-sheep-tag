import { App, newApp } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { newEntity, remove, update } from "./updates.ts";
import { initApp } from "@/shared/context.ts";
import { id } from "@/shared/util/id.ts";

export type Game = App<Entity> & {
  tick: number;
};

function makeLoopGuard(
  label: string,
  warnIters = 100,
  throwIters = 10_000,
) {
  let i = 0, lastWarn = 0;
  return (progressInfo?: string) => {
    i++;
    if (i >= warnIters || (i > warnIters && i - lastWarn >= warnIters)) {
      lastWarn = i;
      console.warn(
        new Error(
          `[loop-warn] ${label} i=${i}${
            progressInfo ? " " + progressInfo : ""
          }`,
        ),
      );
    }
    if (i >= throwIters) {
      const msg = `[loop-infinite] ${label} exceeded ${throwIters} iterations${
        progressInfo ? " " + progressInfo : ""
      }`;
      console.error(msg);
      throw new Error(msg);
    }
  };
}

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

  const app = newApp<Entity>({
    initializeEntity,
    flush: () => {
      // Guard for the outer flush loop (total iterations across entire flush)
      const guardFlush = makeLoopGuard("flush-outer", 10, 1000);

      // Guards per entity - persists across the entire flush
      const entityGuards = new Map<string, ReturnType<typeof makeLoopGuard>>();

      // Guards per (entity, system) pair - persists across the entire flush
      const changeGuards = new Map<string, ReturnType<typeof makeLoopGuard>>();

      // Outer drainer
      while (app.callbackQueue.length || app.entityChangeQueue.size) {
        guardFlush(
          `callbacks=${app.callbackQueue.length} entities=${app.entityChangeQueue.size}`,
        );

        // Entity queue drainer
        while (app.entityChangeQueue.size) {
          const [entity, changes] = app.entityChangeQueue.entries().next()
            .value!;

          // Get or create guard for this entity (persists across re-queues)
          if (!entityGuards.has(entity.id)) {
            entityGuards.set(
              entity.id,
              makeLoopGuard(`flush-entity[${entity.id}]`, 50, 500),
            );
          }
          const guardEntity = entityGuards.get(entity.id)!;

          // Per-entity changes drainer
          while (changes.size) {
            const [system, props] = changes.entries().next().value!;

            // Get or create guard for this (entity, system) pair (persists across re-queues)
            const systemName = (system as { name?: string }).name || "unknown";
            const systemKey = `${entity.id}:${systemName}`;
            if (!changeGuards.has(systemKey)) {
              changeGuards.set(
                systemKey,
                makeLoopGuard(`flush-change[${systemKey}]`, 50, 500),
              );
            }
            const guardChange = changeGuards.get(systemKey)!;

            guardEntity(`changes=${changes.size}`);
            guardChange(`props=[${Array.from(props).join(",")}]`);

            changes.delete(system);

            // Already in the system; either a change or removal
            if (system.entities.has(entity)) {
              // If every modified prop is present, it's a change
              if (
                Array.from(props).every((p) => entity[p] != null) &&
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

  initApp(app);

  return app;
};

import("./systems/clearFlags.ts");

import("./systems/action/action.ts");
import("./systems/auras.ts");
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
import("./systems/projectile.ts");
import("./systems/queues.ts");
import("./systems/regen.ts");
import("./orders/index.ts");
