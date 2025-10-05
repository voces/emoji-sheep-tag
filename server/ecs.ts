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
    if (i === warnIters || (i > warnIters && i - lastWarn >= warnIters)) {
      lastWarn = i;
      console.warn(
        `[loop-warn] ${label} i=${i}${progressInfo ? " " + progressInfo : ""}`,
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
      // Guards per loop level
      const guardFlush = makeLoopGuard("flush-outer");
      const guardEntity = makeLoopGuard("flush-entities");
      const guardChange = makeLoopGuard("flush-changes");

      // Track “progress” per outer cycle: how many changes/callbacks we actually applied
      let appliedThisCycle = 0;

      // Outer drainer
      while (app.callbackQueue.length || app.entityChangeQueue.size) {
        const beforeCallbacks = app.callbackQueue.length;
        const beforeEntities = app.entityChangeQueue.size;

        // Entity queue drainer
        while (app.entityChangeQueue.size) {
          guardEntity(`entities=${app.entityChangeQueue.size}`);

          const [entity, changes] = app.entityChangeQueue.entries().next()
            .value!;
          const beforeChanges = changes.size;

          // Per-entity changes drainer
          while (changes.size) {
            const [system, props] = changes.entries().next().value!;
            guardChange(
              `entity=${entity.id} changes=${changes.size} props=[${
                Array.from(props).join(",")
              }]`,
            );

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

            appliedThisCycle++;
          }

          // No-progress detector for per-entity loop:
          // if we did not reduce `changes.size`, we’re stuck in a self-replenishing loop.
          if (changes.size >= beforeChanges) {
            throw new Error(
              `[loop-stall] changes did not shrink for entity; size=${changes.size}`,
            );
          }

          app.entityChangeQueue.delete(entity);
        }

        // Drain callbackQueue once per outer cycle (callbacks may enqueue more work)
        if (app.callbackQueue.length) {
          const cb = app.callbackQueue.shift()!;
          cb();
          appliedThisCycle++;
        }

        // Outer no-progress detector:
        // if neither queue shrank AND we didn’t apply anything, we’re spinning.
        if (
          app.callbackQueue.length >= beforeCallbacks &&
          app.entityChangeQueue.size >= beforeEntities &&
          appliedThisCycle === 0
        ) {
          throw new Error(
            `[loop-stall] flush made no progress (callbacks=${app.callbackQueue.length}, entities=${app.entityChangeQueue.size})`,
          );
        }

        guardFlush(
          `callbacks=${app.callbackQueue.length} entities=${app.entityChangeQueue.size}`,
        );
        appliedThisCycle = 0; // reset for next outer cycle
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
