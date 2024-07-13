import { loadSvg } from "./loadSvg.ts";

//@deno-types="./assets/svg.d.ts"
import sheepSvg from "./assets/sheep.svg";
//@deno-types="./assets/svg.d.ts"
import wolfSvg from "./assets/wolf.svg";
//@deno-types="./assets/svg.d.ts"
import hutSvg from "./assets/hut.svg";
// //@deno-types="./assets/svg.d.ts"
// import houseSvg from "./assets/house.svg";
// //@deno-types="./assets/svg.d.ts"
// import derelictHouse from "./assets/derelictHouse.svg";
import { app, Entity } from "./ecs.ts";
import { getLocalPlayer, playersVar } from "./ui/vars/players.ts";
import { Color } from "three";
import { InstancedGroup } from "./InstancedGroup.ts";

const sheep = loadSvg(sheepSvg, 1);
const wolves = loadSvg(wolfSvg, 2);
const huts = loadSvg(hutSvg, 2);
// const houses = loadSvg(houseSvg, 2);
// const derelictHouses = loadSvg(derelictHouse, 2);

const collections: Record<string, InstancedGroup | undefined> = {
  sheep,
  wolf: wolves,
  hut: huts,
  // house: houses,
  // derelictHouse: derelictHouses,
};

app.addSystem({
  props: ["id", "kind", "owner"],
  onAdd: (e) => {
    const collection = collections[e.kind];
    if (!collection) return;
    const p = playersVar().find((p) => p.id === e.owner);
    if (p) collection.setColorAt(e.id, new Color(p.color));
    if (
      e.owner === getLocalPlayer()?.id &&
      (e.kind === "sheep" || e.kind === "wolf")
    ) {
      e.selected = true;
    }
  },
});

app.addSystem({
  props: ["id", "kind", "position"],
  onAdd: (e) => {
    collections[e.kind]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    );
  },
  onChange: (e) =>
    collections[e.kind]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    ),
  onRemove: (e) => {
    console.log("delete", e);
    collections[e.kind!]?.delete(e.id!);
  },
});

app.addSystem({
  props: ["id", "kind", "movement"],
  onAdd: (e) => {
    if (e.position || !e.movement.length) return;
    e.position = e.movement[0];
  },
  updateChild: (unit, delta) => {
    // Clear and skip if no speed, movement empty, or already at target
    if (
      !unit.movementSpeed ||
      !unit.movement.length ||
      (unit.movement[0].x === unit.position?.x &&
        unit.movement[0].y === unit.position?.y)
    ) {
      delete (unit as Entity).movement;
      return;
    }

    let movement = unit.movementSpeed * delta;

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

export const selection = app.addSystem({ props: ["selected"] }).entities;
