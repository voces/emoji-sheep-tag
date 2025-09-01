import { App, newApp, SystemEntity as ECSSystemEntity } from "jsr:@verit/ecs";
import { onRender } from "./graphics/three.ts";
import { Entity as CommonEntity } from "@/shared/types.ts";
import { appContext, initApp } from "@/shared/context.ts";
import { generateDoodads } from "@/shared/map.ts";

export type Entity = CommonEntity & {
  selected?: boolean;
  /** Blueprint color */
  blueprint?: number;
  zIndex?: number;
  playerColor?: string;
  isKaboom?: boolean;
  selectable?: boolean;
  /** Server position for restoring after failed interpolation */
  serverPosition?: { readonly x: number; readonly y: number };
};

export type SystemEntity<K extends keyof Entity> = ECSSystemEntity<Entity, K>;

type Listeners = {
  [key in keyof Entity]?: Set<((entity: Entity, prev: unknown) => void)>;
};
const allListeners = new WeakMap<Entity, Listeners>();

export const listen = <P extends keyof Entity>(
  entity: Entity,
  props: P | P[],
  fn: (entity: Entity, prev: Entity[P]) => void,
) => {
  const listeners = allListeners.get(entity);
  if (!listeners) return () => {};
  for (const prop of Array.isArray(props) ? props : [props]) {
    const set = listeners[prop] ?? (listeners[prop] = new Set());
    set.add(fn as (entity: Entity, prev: unknown) => void);
  }
  return () => {
    for (const prop of Array.isArray(props) ? props : [props]) {
      const set = listeners[prop];
      set?.delete(fn as (entity: Entity, prev: unknown) => void);
    }
  };
};

// let counter = 0;
export const app = newApp<Entity>({
  initializeEntity: (entity: Partial<Entity>) => {
    if (!entity.id) throw new Error("Expected entity to have an id");
    // Newest entity on top; works with 2D graphics
    // entity.zIndex ??= counter++ / 100000;
    const listeners: Listeners = {};
    const proxy = new Proxy(entity as Entity, {
      set: (target, prop, value) => {
        const prev = target[prop as keyof Entity];
        if (prev === value) return true;
        // deno-lint-ignore no-explicit-any
        (target as any)[prop] = value;
        app.queueEntityChange(proxy, prop as keyof Entity);
        listeners[prop as keyof Entity]?.forEach((fn) => fn(proxy, prev));
        return true;
      },
      deleteProperty: (target, prop) => {
        const prev = target[prop as keyof Entity];
        if (prev == null) return true;
        // deno-lint-ignore no-explicit-any
        delete (target as any)[prop];
        app.queueEntityChange(proxy, prop as keyof Entity);
        listeners[prop as keyof Entity]?.forEach((fn) => fn(proxy, prev));
        return true;
      },
    });
    allListeners.set(proxy, listeners);
    return proxy;
  },
}) as App<Entity>;
// deno-lint-ignore no-explicit-any
(globalThis as any).app = app;

appContext.current = app;

queueMicrotask(() => initApp(app));

onRender((delta, time) => app.update(delta, time));

export const map: Record<string, Entity> = {};

export const unloadEcs = () => {
  for (const entity of app.entities) app.removeEntity(entity);
  for (const key in map) delete map[key];
  generateDoodads(app);
};

generateDoodads(app);
