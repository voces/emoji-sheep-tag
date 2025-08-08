import { App, newApp, SystemEntity as ECSSystemEntity } from "jsr:@verit/ecs";
import { onRender } from "./graphics/three.ts";
import { Entity as CommonEntity } from "../shared/types.ts";
import { TypedEventTarget } from "typed-event-target";
import { GameEvents } from "../server/ecs.ts";

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

class EntityCreatedEvent extends Event {
  constructor(readonly entity: Entity) {
    super("entityCreated");
  }
}

type LocalGameEvents = {
  entityCreated: EntityCreatedEvent;
};

class GameTarget extends TypedEventTarget<LocalGameEvents & GameEvents> {
  constructor(readonly initializeEntity: (input: Partial<Entity>) => Entity) {
    super();
  }
}

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
export const app = newApp<Entity>(
  new GameTarget(
    (entity) => {
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
      queueMicrotask(() =>
        app.dispatchTypedEvent("entityCreated", new EntityCreatedEvent(proxy))
      );
      return proxy;
    },
  ),
) as GameTarget & App<Entity>;
// deno-lint-ignore no-explicit-any
(globalThis as any).app = app;

onRender((delta, time) => app.update(delta, time));
