import { mouse } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";
import { Entity } from "./ecs.ts";
import { getLocalPlayer } from "./ui/vars/players.ts";
import { selection } from "./systems/autoSelect.ts";
import { camera } from "./graphics/three.ts";

const normalize = (value: number) => Math.round(value * 2) / 2;

mouse.addEventListener("mouseButtonDown", (e) => {
  if (!selection.size) return;

  if (e.button === "right") {
    if (e.intersects.size) {
      console.log("inside");
      const intersects = Array.from(e.intersects);
      const selections = selection.clone();

      // Do not target self? At least for move/attack
      for (const s of selections) if (e.intersects.has(s)) selections.delete(s);
      if (!selections.size) return;

      const attackers = selections.filter((e) => e.attack);

      console.log(
        Array.from(selections, (e) => e.id),
        "right clicks",
        Array.from(e.intersects, (e) => e.id),
      );
    }
    send({
      type: "move",
      units: Array.from(selection, (e) => e.id),
      x: e.world.x,
      y: e.world.y,
    });
  } else if (e.button === "left" && blueprint) {
    send({
      type: "build",
      unit: Array.from(
        selection.filter((u) => u.builds?.includes("hut")),
        (e) => e.id,
      )[0],
      buildType: "hut",
      x: normalize(e.world.x),
      y: normalize(e.world.y),
    });
    app.delete(blueprint);
    blueprint = undefined;
  }
});

mouse.addEventListener("mouseMove", (e) => {
  if (blueprint) {
    blueprint.position = { x: normalize(e.world.x), y: normalize(e.world.y) };
  }
});

const keyboard: Record<string, boolean> = {};

let blueprintIndex = 0;
let blueprint: Entity | undefined;
globalThis.addEventListener("keydown", (e) => {
  keyboard[e.code] = true;
  if (!selection.some((u) => u.builds?.includes("hut"))) return;
  if (blueprint) app.delete(blueprint);
  if (e.code === "KeyF") {
    blueprint = app.add({
      id: `blueprint-${blueprintIndex}`,
      unitType: "hut",
      position: { x: normalize(mouse.world.x), y: normalize(mouse.world.y) },
      owner: getLocalPlayer()?.id,
      blueprint: true,
    });
  }
});

globalThis.addEventListener("keyup", (e) => {
  delete keyboard[e.code];
});

app.addSystem({
  update: (delta) => {
    const x = (keyboard.ArrowLeft ? -1 : 0) + (keyboard.ArrowRight ? 1 : 0);
    const y = (keyboard.ArrowDown ? -1 : 0) + (keyboard.ArrowUp ? 1 : 0);
    if (x) camera.position.x += x * delta * 10;
    if (y) camera.position.y += y * delta * 10;
  },
});
