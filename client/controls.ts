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
import { canBuild, isEnemy } from "./api/unit.ts";
import { updateCursor } from "./graphics/cursor.ts";
import { playSound, playSoundAt } from "./api/sound.ts";
import { pick } from "./util/pick.ts";
import { showChatBoxVar } from "./ui/pages/Game/Chat.tsx";
import { showCommandPaletteVar } from "./ui/components/CommandPalette.tsx";
import { stateVar } from "./ui/vars/state.ts";
import { newIndicator } from "./systems/indicators.ts";
import { shortcutsVar } from "./ui/pages/Settings.tsx";
import { actionToShortcutKey } from "./util/actionToShortcutKey.ts";
import { showSettingsVar } from "./ui/vars/showSettings.ts";

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
    newIndicator({
      x: target.position?.x ?? e.world.x,
      y: target.position?.y ?? e.world.y,
    }, {
      model: "gravity",
      color: "#dd3333",
      scale: target.radius ? target.radius * 4 : 1,
    });
  }

  if (movers?.size) {
    // Should follow
    send({
      type: "move",
      units: Array.from(movers, (e) => e.id),
      target: target.movementSpeed ? target.id : e.world,
    });
    if (!attackers?.size) {
      newIndicator({
        x: target.movementSpeed ? target.position?.x ?? e.world.x : e.world.x,
        y: target.movementSpeed ? target.position?.y ?? e.world.y : e.world.y,
      }, { model: "gravity" });
    }
  }

  return true;
};

const getBuilderFromBlueprint = () => {
  if (!blueprint) return;
  const unitType = blueprint.unitType;
  return setFind(
    selection,
    (u) =>
      u.actions?.some((a) => a.type === "build" && a.unitType === unitType) ??
        false,
  );
};

mouse.addEventListener("mouseButtonDown", (e) => {
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== e.element
  ) document.activeElement.blur();

  if (e.element instanceof HTMLElement && e.element.id !== "ui") {
    e.element.focus();
    e.element.click();
    return;
  }

  // if (document.activeElement && document.activeElement !== e.element) document.activeElement.dispatchEvent()
  // if (showChatBoxVar() === "open") showChatBoxVar("dismissed");
  // if (showCommandPaletteVar() === "open") showCommandPaletteVar("dismissed");

  if (!selection.size) return;

  if (e.button === "right") {
    if (selection.size) {
      const source = selection.first()?.position;
      if (source) {
        playSoundAt(
          pick("click1", "click2", "click3", "click4"),
          e.world.x,
          e.world.y,
          0.1,
        );
      }
    }

    if (e.intersects.size && handleSmartTarget(e)) return;

    send({
      type: "move",
      units: Array.from(selection, (e) => e.id),
      target: e.world,
    });
    newIndicator({ x: e.world.x, y: e.world.y }, { model: "gravity" });
  } else if (e.button === "left") {
    if (blueprint) {
      const unitType = blueprint.unitType;
      const unit = getBuilderFromBlueprint();
      if (!unit) return;
      const x = normalize(
        e.world.x,
        (unitData[unitType]?.tilemap?.width ?? 0) % 4 === 0,
      );
      const y = normalize(
        e.world.y,
        (unitData[unitType]?.tilemap?.height ?? 0) % 4 === 0,
      );
      if (!canBuild(unit, unitType, x, y)) return;

      app.removeEntity(blueprint);
      blueprint = undefined;
      updateCursor();
      if (selection.size) {
        const source = selection.first()?.position;
        if (source) {
          playSoundAt(
            pick("click1", "click2", "click3", "click4"),
            e.world.x,
            e.world.y,
            0.1,
          );
        }
      }
      send({ type: "build", unit: unit.id, buildType: unitType, x, y });
    }
  }
});

let hover: Element | null = null;
mouse.addEventListener("mouseMove", (e) => {
  if (blueprint) {
    const builder = getBuilderFromBlueprint();
    if (!builder) return;
    const x = normalize(
      e.world.x,
      (unitData[blueprint.unitType]?.tilemap?.width ?? 0) % 4 === 0,
    );
    const y = normalize(
      e.world.y,
      (unitData[blueprint.unitType]?.tilemap?.height ?? 0) % 4 === 0,
    );
    blueprint.position = { x, y };
    blueprint.blueprint = canBuild(builder, blueprint.unitType, x, y)
      ? 0x0000ff
      : 0xff0000;
  }

  if (hover !== e.element) {
    hover?.classList.remove("hover");
    e.element?.classList.add("hover");
    hover = e.element;
  }

  updateCursor(true);
});

export const keyboard: Record<string, boolean> = {};

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

const cancelBlueprint = () => {
  if (blueprint) {
    app.removeEntity(blueprint);
    blueprint = undefined;
    updateCursor();
  }
};

document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) cancelBlueprint();
});

let blueprintIndex = 0;
let blueprint: SystemEntity<Entity, "unitType"> | undefined;
export const clearBlueprint = (
  fn?: (blueprint: SystemEntity<Entity, "unitType">) => void,
) => {
  if (blueprint && (!fn || fn(blueprint))) cancelBlueprint();
};
export const hasBlueprint = () => !!blueprint;

globalThis.addEventListener("keydown", (e) => {
  keyboard[e.code] = true;

  if (showSettingsVar()) return false;

  const shortcuts = shortcutsVar();
  const checkShortcut = (shortcut: string[]) =>
    shortcut.includes(e.code) && shortcut.every((s) => keyboard[s]);

  if (
    document.activeElement instanceof HTMLInputElement &&
    (document.activeElement.value || e.shiftKey || e.ctrlKey || e.metaKey)
  ) return;

  if (
    checkShortcut(shortcuts.misc.openCommandPalette) &&
    showCommandPaletteVar() === "closed"
  ) {
    e.preventDefault();
    showCommandPaletteVar("open");
    return false;
  }

  if (
    checkShortcut(shortcuts.misc.openChat) &&
    showChatBoxVar() !== "open" && showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    showChatBoxVar("open");
    return false;
  }

  // Arrow keys to switch between commands; not modifiable
  if (
    (showChatBoxVar() === "open" || showCommandPaletteVar() === "open") &&
    !("fromHud" in e)
  ) {
    if (
      showCommandPaletteVar() === "open" && e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) e.preventDefault();
    return false;
  }

  // Cancel
  if (checkShortcut(shortcuts.misc.cancel)) {
    cancelBlueprint();
    return false;
  }

  const units: Entity[] = [];
  let action: UnitDataAction | undefined;
  for (const entity of selection) {
    if (!entity.actions) continue;
    for (const a of entity.actions) {
      if (
        (a.binding?.includes(e.code) && a.binding.every((b) => keyboard[b])) &&
        (!action || isSameAction(action, a))
      ) {
        action = a;
        units.push(entity);
      }
    }
  }

  if (!action) return;

  if (action.type === "build") {
    if (blueprint) app.removeEntity(blueprint);
    const x = normalize(
      mouse.world.x,
      (unitData[action.unitType]?.tilemap?.width ?? 0) % 4 === 0,
    );
    const y = normalize(
      mouse.world.y,
      (unitData[action.unitType]?.tilemap?.height ?? 0) % 4 === 0,
    );
    blueprint = app.addEntity({
      id: `blueprint-${blueprintIndex}`,
      unitType: action.unitType,
      position: { x, y },
      owner: getLocalPlayer()?.id,
      model: unitData[action.unitType]?.model,
      modelScale: unitData[action.unitType]?.modelScale,
      blueprint: canBuild(units[0], action.unitType, x, y)
        ? 0x0000ff
        : 0xff0000,
    });
    updateCursor();
    return;
  }

  if (action.type === "auto") {
    if (units.length === 0 && units[0].position) {
      playSoundAt(
        pick("click1", "click2", "click3", "click4"),
        units[0].position.x,
        units[0].position.y,
        0.1,
      );
    } else {
      playSound(pick("click1", "click2", "click3", "click4"), {
        volume: 0.1,
      });
    }

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

globalThis.addEventListener("blur", () => {
  for (const key in keyboard) delete keyboard[key];
});

globalThis.addEventListener("wheel", (e) => {
  if (
    document.elementFromPoint(
      mouse.pixels.x,
      mouse.pixels.y,
    )?.id !== "ui"
  ) return false;

  camera.position.z += e.deltaY > 0 ? 1 : -1;
});

let startPan: number | undefined;
app.addSystem({
  update: (delta, time) => {
    if (showSettingsVar()) return false;

    const skipKeyboard = showCommandPaletteVar() === "open";

    let x = (keyboard.ArrowLeft && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowRight && !skipKeyboard ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.x <= 12 ? -2 : 0) +
          (window.innerWidth - mouse.pixels.x <= 12 ? 2 : 0)
        : 0);
    let y = (keyboard.ArrowDown && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowUp && !skipKeyboard ? 1 : 0) +
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

const shortcutOverrides = (
  e: SystemEntity<Entity, "unitType" | "actions">,
) => {
  const shortcuts = shortcutsVar()[e.unitType];
  if (!shortcuts) return e;
  let overridden = false;
  const newActions = e.actions.map((a) => {
    const binding = shortcuts[actionToShortcutKey(a)];
    if (!binding) return a;
    if (
      a.binding?.length === binding.length &&
      a.binding.some((v, i) => v === binding[i])
    ) return a;
    overridden = true;
    return { ...a, binding };
  });
  if (!overridden) return;
  e.actions = newActions;
};
const unitsWithActions = app.addSystem({
  props: ["unitType", "actions"],
  onAdd: shortcutOverrides,
  onChange: shortcutOverrides,
});
shortcutsVar.subscribe((v) => {
  for (const e of unitsWithActions.entities) shortcutOverrides(e);
});
