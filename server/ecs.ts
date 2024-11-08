import { App, newApp } from "jsr:@verit/ecs";
import { addQueueSystem } from "./systems/queues.ts";
import { addLookupSystem } from "./systems/lookup.ts";
import { addActionTagSystem } from "./systems/actionTags.ts";
import { addUnitMovementSystem } from "./systems/movement.ts";
import { Entity } from "../shared/types.ts";
import { addPathingSystem } from "./systems/pathing.ts";
import { newEntity, remove, update } from "./updates.ts";
import { TypedEventTarget } from "typed-event-target";
import { registerDestroyLastFarm } from "./actions/destroyLastFarm.ts";
import { addPlayerEntitiesSystem } from "./systems/playerEntities.ts";

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

export class UnitEventEvent extends Event {
  constructor(
    readonly unit: Entity,
    readonly player: string,
    readonly abilityId: string,
  ) {
    super("unitEvent");
  }
}

type GameEvents = {
  unitEvent: UnitEventEvent;
};

class GameTarget extends TypedEventTarget<GameEvents> {
  constructor(readonly newEntity: (input: Partial<Entity>) => Entity) {
    super();
  }

  delete(child: Entity) {
    const app = this as unknown as Game;
    for (const system of app.systems) {
      // deno-lint-ignore no-explicit-any
      if (system.entities.has(child as any)) {
        // deno-lint-ignore no-explicit-any
        system.entities.delete(child as any);
        system.onRemove?.(child);
      }
    }

    app.entities.delete(child);

    remove(child.id);
  }
}

export type Game = GameTarget & App<Entity>;

export const newEcs = () => {
  const app = newApp<Entity>(
    new GameTarget(
      (input) => {
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
            return true;
          },
          deleteProperty: (target, prop) => {
            if ((target as any)[prop] == null) return true;
            delete (target as any)[prop];
            app.onEntityPropChange(proxy, prop as any);
            update(target.id, prop as keyof Entity, null);
            return true;
          },
        });
        newEntity(entity);
        return proxy;
      },
    ),
  ) as Game;

  const lookup = addLookupSystem(app);
  addQueueSystem(app);
  addActionTagSystem(app);
  addUnitMovementSystem(app);
  addPathingSystem(app);
  addPlayerEntitiesSystem(app);

  registerDestroyLastFarm(app);

  return { ecs: app, lookup };
};
