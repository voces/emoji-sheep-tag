import { mouse, MouseButtonEvent } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";
import { Entity } from "./ecs.ts";
import { getLocalPlayer } from "./ui/vars/players.ts";
import { selection } from "./systems/autoSelect.ts";
import { camera } from "./graphics/three.ts";
import { UnitDataAction, UnitDataActionTarget } from "../shared/types.ts";
import { absurd } from "../shared/util/absurd.ts";
import { setFind } from "../server/util/set.ts";
import { SystemEntity } from "jsr:@verit/ecs";
import { Classification, unitData } from "../shared/data.ts";
import { tiles } from "../shared/map.ts";
import { canBuild, isEnemy, testClassification } from "./api/unit.ts";
import { CursorVariant, updateCursor } from "./graphics/cursor.ts";
import { playSound, playSoundAt } from "./api/sound.ts";
import { pick } from "./util/pick.ts";
import { showChatBoxVar } from "./ui/pages/Game/Chat.tsx";
import { showCommandPaletteVar } from "./ui/components/CommandPalette.tsx";
import { stateVar } from "./ui/vars/state.ts";
import { newIndicator } from "./systems/indicators.ts";
import { shortcutsVar } from "./ui/pages/Settings.tsx";
import { actionToShortcutKey } from "./util/actionToShortcutKey.ts";
import { showSettingsVar } from "./ui/vars/showSettings.ts";
import { selectEntity } from "./api/selection.ts";

const normalize = (value: number, evenStep: boolean) =>
  evenStep
    ? Math.round(value * 2) / 2
    : (Math.round(value * 2 + 0.5) - 0.5) / 2;

const handleSmartTarget = (e: MouseButtonEvent) => {
  const target = e.intersects.first();
  const localPlayer = getLocalPlayer();
  const selections = selection.clone().filter((s) =>
    s.owner === localPlayer?.id
  );

  const orders = Array.from(
    selections,
    (
      e,
    ) =>
      [
        e,
        e.actions?.filter((a): a is UnitDataActionTarget =>
          a.type === "target" && (target
            ? testClassification(e, target, a.targeting)
            : typeof a.aoe === "number")
        ).sort((a, b) => {
          const aValue = a.smart
            ? Object.entries(a.smart).reduce(
              (min, [classification, priority]) => {
                const test = (target && classification !== "ground"
                    ? testClassification(e, target, [
                      classification as Classification,
                    ])
                    : typeof a.aoe === "number" && classification === "ground")
                  ? priority
                  : Infinity;
                return test < min ? test : min;
              },
              Infinity,
            )
            : Infinity;
          const bValue = b.smart
            ? Object.entries(b.smart).reduce(
              (min, [classification, priority]) => {
                const test = (target && classification !== "ground"
                    ? testClassification(e, target, [
                      classification as Classification,
                    ])
                    : typeof a.aoe === "number" && classification === "ground")
                  ? priority
                  : Infinity;
                return test < min ? test : min;
              },
              Infinity,
            )
            : Infinity;
          return aValue - bValue;
        })[0],
      ] as const,
  ).filter((
    pair,
  ): pair is readonly [
    SystemEntity<Entity, "selected">,
    UnitDataActionTarget,
  ] => !!pair[1]);

  if (!orders.length) return false;

  const groupedOrders = orders.reduce((groups, [unit, action]) => {
    if (!groups[action.order]) groups[action.order] = [];
    groups[action.order].push(unit);
    return groups;
  }, {} as Record<string, Entity[]>);

  let targetTarget = false;

  for (const order in groupedOrders) {
    const againstTarget = target && (order !== "move" || target.movementSpeed);
    if (againstTarget) targetTarget = true;

    send({
      type: "unitOrder",
      units: Array.from(groupedOrders[order], (e) => e.id),
      order: order,
      target: againstTarget ? target.id : e.world,
    });
  }

  newIndicator({
    x: targetTarget ? target?.position?.x ?? e.world.x : e.world.x,
    y: targetTarget ? target?.position?.y ?? e.world.y : e.world.y,
  }, {
    model: "gravity",
    color: target && orders.some(([u]) => isEnemy(u, target))
      ? "#dd3333"
      : undefined,
    scale: targetTarget && target?.radius ? target.radius * 4 : 1,
  });

  cancelOrder();

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

  if (
    (e.element instanceof HTMLElement || e.element instanceof SVGElement) &&
    e.element.id !== "ui"
  ) {
    e.element.focus();
    if ("click" in e.element) e.element.click();
    else {
      e.element.dispatchEvent(
        new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    return;
  }

  // if (document.activeElement && document.activeElement !== e.element) document.activeElement.dispatchEvent()
  // if (showChatBoxVar() === "open") showChatBoxVar("dismissed");
  // if (showCommandPaletteVar() === "open") showCommandPaletteVar("dismissed");

  if (e.button === "right") {
    if (selection.size) {
      playSoundAt(
        pick("click1", "click2", "click3", "click4"),
        e.world.x,
        e.world.y,
        0.1,
      );

      handleSmartTarget(e);
    }
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
    } else if (activeOrder) {
      const target = e.intersects.first();
      const unitsWithTarget = selection.filter((e) =>
        e.actions?.some((a) =>
          a.type === "target" && a.order === activeOrder?.order &&
          target && testClassification(e, target, a.targeting)
        )
      );
      if (target && unitsWithTarget.size) {
        send({
          type: "unitOrder",
          units: Array.from(unitsWithTarget, (e) => e.id),
          order: activeOrder.order,
          target: target.id,
        });
      }

      const unitsWithoutTarget = selection.filter((e) =>
        !unitsWithTarget.has(e) &&
        e.actions?.some((a) =>
          a.type === "target" && a.order === activeOrder?.order &&
          typeof a.aoe === "number"
        )
      );
      if (unitsWithoutTarget.size) {
        send({
          type: "unitOrder",
          units: Array.from(unitsWithoutTarget, (e) => e.id),
          order: activeOrder.order,
          target: e.world,
        });
      }

      if (unitsWithTarget.size || unitsWithoutTarget.size) {
        newIndicator({
          x: unitsWithTarget.size
            ? target?.position?.x ?? e.world.x
            : e.world.x,
          y: unitsWithTarget.size
            ? target?.position?.y ?? e.world.y
            : e.world.y,
        }, {
          model: "gravity",
          color: target && unitsWithTarget.some((u) => isEnemy(u, target))
            ? "#dd3333"
            : undefined,
          scale: unitsWithTarget.size && target?.radius ? target.radius * 4 : 1,
        });

        cancelOrder();
      }
    } else if (e.intersects.size) {
      selectEntity(e.intersects.first()!);
    }
  }
});

let hover: Element | null = null;
let hovers: Element[] = [];
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
    hover?.dispatchEvent(
      new MouseEvent("mouseout", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    e.element?.dispatchEvent(
      new MouseEvent("mouseover", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    hover = e.element;
  }

  for (const el of hovers) {
    if (!e.elements.includes(el)) el?.classList.remove("hover");
  }
  for (const el of e.elements) {
    if (!hovers.includes(el)) el.classList.add("hover");
  }
  hovers = e.elements;

  updateCursor(true);
});

export const keyboard: Record<string, boolean> = {};

const isSameAction = (a: UnitDataAction, b: UnitDataAction) => {
  switch (a.type) {
    case "auto":
      return b.type === "auto" && a.order === b.order;
    case "build":
      return b.type === "build" && a.unitType === b.unitType;
    case "target":
      return b.type === "target" && a.order === b.order;
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

export const cancelOrder = (
  check?: (order: string | undefined, blueprint: string | undefined) => boolean,
) => {
  if (check && !check(activeOrder?.order, blueprint?.unitType)) return;
  if (activeOrder) {
    activeOrder = undefined;
    updateCursor();
  }
  cancelBlueprint();
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

let activeOrder: { variant: CursorVariant; order: string } | undefined;
export const getActiveOrder = () => activeOrder;

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
    cancelOrder();
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

  cancelOrder();

  switch (action.type) {
    case "auto":
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
      break;
    case "build": {
      const x = normalize(
        mouse.world.x,
        (unitData[action.unitType]?.tilemap?.width ?? 0) % 4 === 0,
      );
      const y = normalize(
        mouse.world.y,
        (unitData[action.unitType]?.tilemap?.height ?? 0) % 4 === 0,
      );
      blueprint = app.addEntity({
        id: `blueprint-${blueprintIndex++}`,
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
      break;
    }
    case "target":
      activeOrder = {
        order: action.order,
        variant: action.order === "attack" ? "enemy" : "ally",
      };
      updateCursor();
      break;

    default:
      absurd(action);
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
          (globalThis.innerWidth - mouse.pixels.x <= 12 ? 2 : 0)
        : 0);
    let y = (keyboard.ArrowDown && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowUp && !skipKeyboard ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.y <= 12 ? 2 : 0) +
          (globalThis.innerHeight - mouse.pixels.y <= 12 ? -2 : 0)
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

for (const event of ["pointerdown", "keydown", "contextmenu"]) {
  globalThis.document.body.addEventListener(event, async () => {
    if (!document.pointerLockElement) {
      try {
        await globalThis.document.body.requestPointerLock({
          unadjustedMovement: true,
        });
      } catch { /** do nothing */ }
    }
  });
}

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
shortcutsVar.subscribe(() => {
  for (const e of unitsWithActions.entities) shortcutOverrides(e);
});
