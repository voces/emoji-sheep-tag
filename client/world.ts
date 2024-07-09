import { loadSvg } from "./loadSvg.ts";

//@deno-types="./assets/svg.d.ts"
import sheepSvg from "./assets/sheep.svg";
//@deno-types="./assets/svg.d.ts"
import wolfSvg from "./assets/wolf.svg";
//@deno-types="./assets/svg.d.ts"
import hutSvg from "./assets/hut.svg";
//@deno-types="./assets/svg.d.ts"
import houseSvg from "./assets/house.svg";
//@deno-types="./assets/svg.d.ts"
import derelictHouse from "./assets/derelictHouse.svg";
import { speeds } from "../shared/constants.ts";
import { app, Entity } from "./ecs.ts";
import { playersVar } from "./ui/vars/players.ts";
import { Color } from "three";

const sheep = loadSvg(sheepSvg, 1);
const wolves = loadSvg(wolfSvg, 2);
const huts = loadSvg(hutSvg, 2);
const houses = loadSvg(houseSvg, 2);
const derelictHouses = loadSvg(derelictHouse, 2);

const collections = {
  sheep,
  wolf: wolves,
  hut: huts,
  house: houses,
  derelictHouse: derelictHouses,
};

type MovingUnit = {
  id: string;
  kind: "sheep" | "wolf";
  movement: { x: number; y: number }[];
};
const movingUnits: Record<string, MovingUnit> = {};

app.addSystem({
  props: ["id", "kind", "owner"],
  onAdd: (e) => {
    const collection = collections[e.kind];
    const p = playersVar().find((p) => p.id === e.owner);
    if (p) collection.setColorAt(e.id, new Color(p.color));
  },
});

app.addSystem({
  props: ["id", "kind", "position"],
  onAdd: (e) =>
    collections[e.kind].setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    ),
  onChange: (e) =>
    collections[e.kind].setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    ),
});

app.addSystem({
  props: ["id", "kind", "movement"],
  updateChild: (unit, delta) => {
    let movement =
      ((speeds as Record<string, number | undefined>)[unit.kind] ?? 0) * delta;

    // Clear and skip if no speed, movement empty, or already at target
    if (
      !movement ||
      !unit.movement.length ||
      (unit.movement[0].x === unit.position?.x &&
        unit.movement[0].y === unit.position?.y)
    ) {
      delete (unit as Entity).movement;
      return;
    }

    // Set initial position if not already set
    if (!unit.position) unit.position = unit.movement[0];

    // Tween along movement
    let remaining = ((unit.movement[0].x - unit.position.x) ** 2 +
      (unit.movement[0].y - unit.position.y) ** 2) ** 0.5;
    let p = movement / remaining;
    let last = unit.movement[0];
    let nextMovement = [...unit.movement];
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
      x = unit.position.x * (1 - p) + unit.movement[0].x * p;
      y = unit.position.y * (1 - p) + unit.movement[0].y * p;
      if (nextMovement.length !== unit.movement.length) {
        unit.movement = nextMovement;
      }
      // Otherwise update position to end & clear
    } else {
      x = last.x;
      y = last.y;
      delete (unit as Entity).movement;
    }
    if (x !== unit.position.x || y !== unit.position.y) {
      unit.position = { x, y };
    }

    // collections[unit.kind].setPositionAt(unit.id, x, y);
    // console.log(x > 0 ? 0 : Math.PI/2);
    // sheep.setFacingAt(unit.id, x > 0 ? "right" : "left");
  },
});
