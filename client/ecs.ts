import { newApp } from "jsr:@verit/ecs";
import { onRender } from "./three.ts";
import { Entity as ServerEntity } from "../server/ecs.ts";

export type Entity = ServerEntity & { selected?: boolean };

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

onRender((delta) => app.update(delta));
