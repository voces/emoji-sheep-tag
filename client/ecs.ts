import { newApp } from "jsr:@verit/ecs";
import { onRender } from "./graphics/three.ts";
import { Entity as CommonEntity } from "../shared/types.ts";

export type Entity = CommonEntity & {
  selected?: boolean;
  blueprint?: boolean;
  zIndex?: number;
};

export const app = newApp<Entity>({
  newEntity: (entity) => {
    if (!entity.id) throw new Error("Expected entity to have an id");
    const proxy = new Proxy(entity as Entity, {
      set: (target, prop, value) => {
        if ((target as any)[prop] === value) return true;
        (target as any)[prop] = value;
        app.onEntityPropChange(proxy, prop as any);
        return true;
      },
      deleteProperty: (target, prop) => {
        if ((target as any)[prop] == null) return true;
        delete (target as any)[prop];
        app.onEntityPropChange(proxy, prop as any);
        return true;
      },
    });
    return proxy;
  },
});
(globalThis as any).app = app;

onRender((delta, time) => app.update(delta, time));
