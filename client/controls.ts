import { mouse } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";
import { Entity } from "./ecs.ts";
import { getLocalPlayer } from "./ui/vars/players.ts";
import { selection } from "./systems/autoSelect.ts";

const normalize = (value: number) => Math.round(value * 2) / 2;

mouse.addEventListener("mouseButtonDown", (e) => {
  if (e.button === "right") {
    send({
      type: "move",
      units: Array.from(
        selection,
        (e) => e.id,
      ).filter(<T>(
        v: T | undefined,
      ): v is T => !!v),
      x: e.world.x,
      y: e.world.y,
    });
  } else if (e.button === "left" && blueprint) {
    send({
      type: "build",
      unit: Array.from(
        selection.filter((u) => u.builds?.includes("hut")),
        (e) => e.id,
      )[0]!,
      buildType: "hut",
      x: normalize(e.world.x),
      y: normalize(e.world.y),
    });
    app.delete(blueprint);
    blueprint = undefined;
  }
});

let blueprintIndex = 0;
let blueprint: Entity | undefined;
globalThis.addEventListener("keydown", (e) => {
  console.log(selection);
  if (!selection.some((u) => u.builds?.includes("hut"))) return;
  if (blueprint) app.delete(blueprint);
  if (e.code === "KeyF") {
    blueprint = app.add({
      id: `blueprint-${blueprintIndex}`,
      unitType: "hut",
      position: { x: normalize(mouse.world.x), y: normalize(mouse.world.y) },
      owner: getLocalPlayer()?.id,
    });
  }
});

mouse.addEventListener("mouseMove", (e) => {
  if (blueprint) {
    blueprint.position = { x: normalize(e.world.x), y: normalize(e.world.y) };
  }
});
