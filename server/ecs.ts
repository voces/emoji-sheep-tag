import { newApp } from "jsr:@verit/ecs";
import { addQueueSystem } from "./systems/queues.ts";
import { addLookupSystem } from "./systems/lookup.ts";
import { addActionTagSystem } from "./systems/actionTags.ts";
import { addUnitMovementSystem } from "./systems/movement.ts";
import { Entity } from "../shared/types.ts";
import { addPathingSystem } from "./systems/pathing.ts";
import { newEntity, update } from "./updates.ts";

// Alphanumeric, minus 0, O, l, and I
const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const toBase58 = (num: number): string => {
  let result = "";
  while (num > 0) {
    result = chars[num % 58] + result;
    num = Math.floor(num / 58);
  }
  return result || "1";
};

let counter = 0;
let counterSecond = 0;
const id = (type?: string) => {
  const second = Math.floor(Date.now() / 1000);
  if (counterSecond !== second) {
    counter = 0;
    counterSecond = second;
  }
  try {
    return type
      ? `${type}-1${toBase58(second)}${toBase58(counter)}`
      : `1${toBase58(second)}${toBase58(counter)}`;
  } finally {
    counter++;
  }
};

export const newEcs = () => {
  const app = newApp<Entity>({
    newEntity: (input) => {
      const entity: Entity = {
        ...input,
        id: input.id || id(input.unitType),
      };
      const proxy = new Proxy(entity, {
        set: (target, prop, value) => {
          if ((target as any)[prop] == value) return true;
          (target as any)[prop] = value;
          app.onEntityPropChange(proxy, prop as any);
          update(target.id, prop as keyof Entity, value);
          // send({
          //   type: "updates",
          //   updates: [{ type: "unit", id: entity.id, [prop]: value }],
          // });
          return true;
        },
        deleteProperty: (target, prop) => {
          if ((target as any)[prop] == null) return true;
          delete (target as any)[prop];
          app.onEntityPropChange(proxy, prop as any);
          update(target.id, prop as keyof Entity, null);
          // send({
          //   type: "updates",
          //   updates: [{ type: "unit", id: entity.id, [prop]: null }],
          // });
          return true;
        },
      });
      newEntity(entity);
      // send({ type: "updates", updates: [{ type: "unit", ...entity }] });
      return proxy;
    },
  });

  const lookup = addLookupSystem(app);
  addQueueSystem(app);
  addActionTagSystem(app);
  addUnitMovementSystem(app);
  addPathingSystem(app);

  return { ecs: app, lookup };
};
