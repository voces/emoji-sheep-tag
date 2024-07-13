import { newApp } from "ecs-proxy";
import { onRender } from "./three.ts";

export type Entity = {
  id: string;
  kind?: string;
  owner?: string;
  mana?: number;
  position?: Readonly<{ x: number; y: number }>;
  movement?: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  movementSpeed?: number;
  selected?: boolean;
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
        delete (target as any)[prop];
        app.onEntityPropChange(proxy, prop as any);
        return true;
      },
    });
    return proxy;
  },
});

onRender((delta) => app.update(delta));
