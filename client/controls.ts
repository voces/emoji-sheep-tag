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
      const intersects = Array.from(e.intersects);
      const selections = selection.clone();

      // Do not target self? At least for move/attack
      for (const s of selections) if (e.intersects.has(s)) selections.delete(s);
      if (!selections.size) return;

      const { attackers, movers } = selections.group((e) =>
        e.attack ? "attackers" as const : "movers" as const
      );

      if (attackers?.size) {
        send({
          type: "attack",
          units: Array.from(attackers, (e) => e.id),
          target: intersects[0].id,
        });
      }

      if (movers?.size) {
        send({
          type: "move",
          units: Array.from(movers, (e) => e.id),
          target: intersects[0].id,
        });
      }
    }

    send({
      type: "move",
      units: Array.from(selection, (e) => e.id),
      target: e.world,
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
    return blueprint = app.add({
      id: `blueprint-${blueprintIndex}`,
      unitType: "hut",
      position: { x: normalize(mouse.world.x), y: normalize(mouse.world.y) },
      owner: getLocalPlayer()?.id,
      blueprint: true,
    });
  }
  if (e.code === "KeyX") {
    const units = selection.filter((u) => u.unitType === "sheep");
    if (units.size) {
      send({
        type: "unitEvent",
        event: "destroyLastFarm",
        units: Array.from(units, (u) => u.id),
      });
    }
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
