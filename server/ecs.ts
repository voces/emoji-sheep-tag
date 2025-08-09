import { App, newApp, System } from "jsr:@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { newEntity, remove, update } from "./updates.ts";
import { TypedEventTarget } from "typed-event-target";

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

export class UnitDeathEvent extends Event {
  constructor(readonly unit: Entity, readonly killer: Entity | undefined) {
    super("unitDeath");
  }
}

export type GameEvents = {
  unitDeath: UnitDeathEvent;
};

class GameTarget extends TypedEventTarget<GameEvents> {
  constructor(readonly initializeEntity: (input: Partial<Entity>) => Entity) {
    super();
  }

  tick = 0;

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

const initHooks: ((game: Game) => void)[] = [];
export const onInit = (fn: (game: Game) => void) => {
  initHooks.push(fn);
};

export const addSystem = <K extends keyof Entity>(
  systemConfig:
    | Partial<System<Entity, K>>
    | ((game: Game) => Partial<System<Entity, K>>),
) =>
  onInit((game) =>
    game.addSystem(
      typeof systemConfig === "function"
        ? systemConfig(game)
        : { ...systemConfig },
    )
  );

export const newEcs = () => {
  const app = newApp<Entity>(
    new GameTarget(
      (input) => {
        const entity: Entity = {
          ...input,
          id: input.id || id(input.prefab),
        };
        const proxy = new Proxy(entity, {
          set: (target, prop, value) => {
            if (target[prop as keyof Entity] === value) return true;
            // deno-lint-ignore no-explicit-any
            (target as any)[prop] = value;
            app.queueEntityChange(proxy, prop as keyof Entity);
            update(target.id, prop as keyof Entity, value);
            return true;
          },
          deleteProperty: (target, prop) => {
            if (target[prop as keyof Entity] == null) return true;
            // deno-lint-ignore no-explicit-any
            delete (target as any)[prop];
            app.queueEntityChange(proxy, prop as keyof Entity);
            update(target.id, prop as keyof Entity, null);
            return true;
          },
        });
        newEntity(entity);
        return proxy;
      },
    ),
  ) as Game;

  for (const hook of initHooks) hook(app);

  return app;
};

import("./events/death.ts");
import("./st/index.ts");
import("./systems/action/action.ts");
import("./systems/autoAttack.ts");
import("./systems/death.ts");
import("./systems/kd.ts");
import("./systems/lookup.ts");
import("./systems/lookup.ts");
import("./systems/manaRegen.ts");
import("./systems/pathing.ts");
import("./systems/pathing.ts");
import("./systems/playerEntities.ts");
import("./systems/playerEntities.ts");
import("./systems/queues.ts");
import("./systems/goldGeneration.ts");
import("./systems/buffs.ts");
import("./orders/index.ts");
