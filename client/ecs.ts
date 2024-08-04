import { newApp } from "jsr:@verit/ecs";
import { Color } from "three";
import { onRender } from "./graphics/three.ts";
import { Entity as CommonEntity } from "../shared/types.ts";

export type Entity = CommonEntity & { selected?: boolean; blueprint?: boolean };

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
        delete (target as any)[prop];
        app.onEntityPropChange(proxy, prop as any);
        return true;
      },
    });
    return proxy;
  },
});
(globalThis as any).app = app;

onRender((delta) => app.update(delta));
