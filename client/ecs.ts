import { App, newApp } from "jsr:@verit/ecs";
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
};

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

// let counter = 0;
export const app = newApp<Entity>(
  new GameTarget(
    (entity) => {
      if (!entity.id) throw new Error("Expected entity to have an id");
      // Newest entity on top; works with 2D graphics
      // entity.zIndex ??= counter++ / 100000;
      const proxy = new Proxy(entity as Entity, {
        set: (target, prop, value) => {
          if ((target as any)[prop] === value) return true;
          (target as any)[prop] = value;
          app.queueEntityChange(proxy, prop as any);
          return true;
        },
        deleteProperty: (target, prop) => {
          if ((target as any)[prop] == null) return true;
          delete (target as any)[prop];
          app.queueEntityChange(proxy, prop as any);
          return true;
        },
      });
      queueMicrotask(() =>
        app.dispatchTypedEvent("entityCreated", new EntityCreatedEvent(proxy))
      );
      return proxy;
    },
  ),
) as GameTarget & App<Entity>;
(globalThis as any).app = app;

onRender((delta, time) => app.update(delta, time));
