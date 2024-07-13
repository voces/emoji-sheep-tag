import { newApp } from "ecs-proxy";
import { send } from "./lobbyApi.ts";

export type Entity = {
  id: string;
  unitType?: string;
  owner?: string;
  mana?: number;
  position?: { readonly x: number; readonly y: number };
  movement?: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  movementSpeed?: number;
};

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
        id: input.id ?? id(input.unitType),
      };
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

  // Alert users to new units
  app.addSystem({
    props: ["unitType"],
    onAdd: (e) => {
      send({
        type: "updates",
        updates: [{
          type: "unit",
          id: e.id,
          kind: e.unitType,
          owner: e.owner,
          position: e.position,
          movement: e.movement,
          movementSpeed: e.movementSpeed,
        }],
      });
    },
  });

  // Unit movement system
  app.addSystem({
    props: ["movement"],
    onAdd: (e) => {
      send({
        type: "updates",
        updates: [{
          type: "unit",
          id: e.id,
          position: e.position,
          movement: e.movement,
        }],
      });
    },
    onChange: (e) => {
      send({
        type: "updates",
        updates: [{
          type: "unit",
          id: e.id,
          position: e.position,
          movement: e.movement,
        }],
      });
    },
    updateChild: (e, delta) => {
      if (
        !e.movementSpeed || !e.movement.length ||
        (e.movement[e.movement.length - 1].x === e.position?.x) &&
          e.movement[e.movement.length - 1].y === e.position.y
      ) return delete (e as Entity).movement;

      let movement = e.movementSpeed * delta;

      if (!e.position) e.position = e.movement[0];

      // Tween along movement
      let remaining = ((e.movement[0].x - e.position.x) ** 2 +
        (e.movement[0].y - e.position.y) ** 2) ** 0.5;
      let p = movement / remaining;
      let last = e.movement[0];
      let nextMovement = [...e.movement];
      while (p > 1) {
        const [, ...shifted] = nextMovement;
        nextMovement = shifted;
        if (nextMovement.length === 0) break;
        else {
          movement -= remaining;
          remaining = ((nextMovement[0].x - last.x) ** 2 +
            (nextMovement[0].y - last.y) ** 2) ** 0.5;
          p = movement / remaining;
          last = nextMovement[0];
        }
      }

      let x: number;
      let y: number;
      // If there is remaining movement, update position and step along
      if (nextMovement.length > 0) {
        x = e.position.x * (1 - p) + e.movement[0].x * p;
        y = e.position.y * (1 - p) + e.movement[0].y * p;
        if (nextMovement.length !== e.movement.length) {
          e.movement = nextMovement;
        }
        // Otherwise update position to end & clear
      } else {
        x = last.x;
        y = last.y;
        delete (e as Entity).movement;
      }
      if (x !== e.position.x || y !== e.position.y) {
        e.position = { x, y };
      }
    },
  });

  // A system to track a reverse map for entity ids to entities
  const lookup: Record<string, Entity | undefined> = {};
  app.addSystem({
    props: ["id"],
    onAdd: (e) => {
      lookup[e.id] = e;
    },
    onRemove: (e) => {
      delete lookup[e.id];
    },
  });

  return { ecs: app, lookup };
};
