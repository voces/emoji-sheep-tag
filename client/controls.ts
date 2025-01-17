import { mouse, MouseButtonEvent } from "./mouse.ts";
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
import { tiles } from "../shared/map.ts";
import { isEnemy } from "./api/unit.ts";
import { updateCursor } from "./graphics/cursor.ts";

const normalize = (value: number, evenStep: boolean) =>
  evenStep
    ? Math.round(value * 2) / 2
    : (Math.round(value * 2 + 0.5) - 0.5) / 2;

const handleSmartTarget = (e: MouseButtonEvent) => {
  const target = e.intersects.values().next().value!;
  const selections = selection.clone();

  // Do not target self? At least for move/attack
  for (const s of selections) if (s === target) selections.delete(s);
  if (!selections.size) return false;

  const { attackers, movers } = selections.group((e) =>
    e.attack && isEnemy(e, target) ? "attackers" as const : "movers" as const
  );

  if (attackers?.size) {
    send({
      type: "attack",
      units: Array.from(attackers, (e) => e.id),
      target: target.id,
    });
  }

  if (movers?.size) {
    // Should follow
    send({
      type: "move",
      units: Array.from(movers, (e) => e.id),
      target: target.movementSpeed ? target.id : e.world,
    });
  }

  return true;
};

mouse.addEventListener("mouseButtonDown", (e) => {
  if (e.element instanceof HTMLElement) e.element.click();

  if (!selection.size) return;

  if (e.button === "right") {
    if (e.intersects.size && handleSmartTarget(e)) return;

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
      updateCursor();
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

let hover: Element | null = null;
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

  if (hover !== e.element) {
    hover?.classList.remove("hover");
    e.element?.classList.add("hover");
    hover = e.element;
  }

  updateCursor(true);
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

const handleEscape = () => {
  if (blueprint) {
    app.delete(blueprint);
    blueprint = undefined;
    updateCursor();
  }
};

document.addEventListener("pointerlockchange", (e) => {
  if (!document.pointerLockElement) handleEscape();
});

let blueprintIndex = 0;
let blueprint: SystemEntity<Entity, "unitType"> | undefined;
export const clearBlueprint = (
  fn?: (blueprint: SystemEntity<Entity, "unitType">) => void,
) => {
  if (blueprint && (!fn || fn(blueprint))) handleEscape();
};
export const hasBlueprint = () => !!blueprint;

globalThis.addEventListener("keydown", (e) => {
  keyboard[e.code] = true;

  if (e.code === "Escape") {
    handleEscape();
    return false;
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
    updateCursor();
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

let startPan: number | undefined;
app.addSystem({
  update: (delta, time) => {
    let x = (keyboard.ArrowLeft ? -1 : 0) + (keyboard.ArrowRight ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.x <= 12 ? -2 : 0) +
          (window.innerWidth - mouse.pixels.x <= 12 ? 2 : 0)
        : 0);
    let y = (keyboard.ArrowDown ? -1 : 0) + (keyboard.ArrowUp ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.y <= 12 ? 2 : 0) +
          (window.innerHeight - mouse.pixels.y <= 12 ? -2 : 0)
        : 0);
    const panDuration = typeof startPan === "number" ? (time - startPan) : 0;
    if (x) {
      x *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.x = Math.min(
        Math.max(0, camera.position.x + x * delta * 10),
        tiles[0].length,
      );
    }
    if (y) {
      y *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.y = Math.min(
        Math.max(0, camera.position.y + y * delta * 10),
        tiles.length,
      );
    }
    if ((x || y) && typeof startPan !== "number") startPan = time;
    else if (!x && !y && typeof startPan === "number") startPan = undefined;

    updateCursor();
  },
});

globalThis.document.body.addEventListener("click", async (e) => {
  if (!document.pointerLockElement) {
    await globalThis.document.body.requestPointerLock({
      unadjustedMovement: true,
    });
  }
});
