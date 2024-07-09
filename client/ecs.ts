import { newApp } from "ecs-proxy";
import { onRender } from "./three.ts";

export type Entity = {
  id?: string;
  kind?: "sheep" | "wolf" | "hut" | "house";
  owner?: string;
  facing?: number;
  mana?: number;
  position?: { readonly x: number; readonly y: number };
  movement?: ReadonlyArray<{ readonly x: number; readonly y: number }>;
};

export const app = newApp<Entity>({
  newEntity: (entity) => {
    const proxy = new Proxy(entity, {
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
