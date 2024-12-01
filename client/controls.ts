import { mouse } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";
import { Entity } from "./ecs.ts";
import { getLocalPlayer } from "./ui/vars/players.ts";
import { selection } from "./systems/autoSelect.ts";
import { camera } from "./graphics/three.ts";
import { UnitDataAction } from "../shared/types.ts";
import { absurd } from "../shared/util/absurd.ts";
import { setFind } from "../server/util/set.ts";
import { SystemEntity } from "jsr:@verit/ecs";
import { unitData } from "../shared/data.ts";

const normalize = (value: number, evenStep: boolean) =>
  evenStep
    ? Math.round(value * 2) / 2
    : (Math.round(value * 2 + 0.5) - 0.5) / 2;

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
        // Should follow
        send({
          type: "move",
          units: Array.from(movers, (e) => e.id),
          target: intersects[0].id,
        });
      }

      return;
    }

    send({
      type: "move",
      units: Array.from(selection, (e) => e.id),
      target: e.world,
    });
  } else if (e.button === "left") {
    if (blueprint) {
      const unitType = blueprint.unitType;
      const unit = setFind(
        selection,
        (u) =>
          u.actions?.some((a) =>
            a.type === "build" && a.unitType === unitType
          ) ?? false,
      )?.id;
      app.delete(blueprint);
      blueprint = undefined;
      if (!unit) return;
      send({
        type: "build",
        unit,
        buildType: unitType,
        x: normalize(
          e.world.x,
          (unitData[unitType]?.tilemap?.width ?? 0) % 4 === 0,
        ),
        y: normalize(
          e.world.y,
          (unitData[unitType]?.tilemap?.height ?? 0) % 4 === 0,
        ),
      });
    }
  }
});

mouse.addEventListener("mouseMove", (e) => {
  if (blueprint) {
    blueprint.position = {
      x: normalize(
        e.world.x,
        (unitData[blueprint.unitType]?.tilemap?.width ?? 0) % 4 === 0,
      ),
      y: normalize(
        e.world.y,
        (unitData[blueprint.unitType]?.tilemap?.height ?? 0) % 4 === 0,
      ),
    };
  }
});

const keyboard: Record<string, boolean> = {};

const isSameAction = (a: UnitDataAction, b: UnitDataAction) => {
  switch (a.type) {
    case "auto":
      return b.type === "auto" && a.order === b.order;
    case "build":
      return b.type === "build" && a.unitType === b.unitType;
    default:
      absurd(a);
  }
};

let blueprintIndex = 0;
let blueprint: SystemEntity<Entity, "unitType"> | undefined;
globalThis.addEventListener("keydown", (e) => {
  keyboard[e.code] = true;

  if (e.code === "Escape" && blueprint) {
    app.delete(blueprint);
    blueprint = undefined;
  }

  const units: Entity[] = [];
  let action: UnitDataAction | undefined;
  for (const entity of selection) {
    if (!entity.actions) continue;
    for (const a of entity.actions) {
      if (a.binding?.[0] === e.code && (!action || isSameAction(action, a))) {
        action = a;
        units.push(entity);
      }
    }
  }

  if (!action) return;

  if (action.type === "build") {
    if (blueprint) app.delete(blueprint);
    blueprint = app.add({
      id: `blueprint-${blueprintIndex}`,
      unitType: action.unitType,
      position: {
        x: normalize(
          mouse.world.x,
          (unitData[action.unitType]?.tilemap?.width ?? 0) % 4 === 0,
        ),
        y: normalize(
          mouse.world.y,
          (unitData[action.unitType]?.tilemap?.height ?? 0) % 4 === 0,
        ),
      },
      owner: getLocalPlayer()?.id,
      blueprint: true,
    });
    return;
  }

  if (action.type === "auto") {
    send({
      type: "unitOrder",
      order: action.order,
      units: units.map((u) => u.id),
    });
    return;
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
