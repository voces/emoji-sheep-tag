import type { Preset } from "./shortcutSettings.ts";
import type { MenuActionRef, MenuConfig } from "./menus.ts";
import { prefabs } from "@/shared/data.ts";
import { actionToShortcutKey } from "../../util/actionToShortcutKey.ts";

export type PresetOverrides = {
  bindings: Record<string, Record<string, string[]>>;
  menus: MenuConfig[];
  useSlotBindings?: boolean;
  clearOrderOnRightClick?: boolean;
};

const sheepBuildActions: MenuActionRef[] = (prefabs.sheep?.actions ?? [])
  .filter((a) => a.type === "build")
  .map((a) => ({ type: "action", actionKey: `build-${a.unitType}` }));

// WC3 remaps for common actions across all prefabs that have them
const wc3CommonRemaps: Record<string, string[]> = {
  move: ["KeyM"],
  stop: ["KeyS"],
  selfDestruct: ["KeyD"],
};

const wc3ActionOverrides: Record<string, Record<string, string[]>> = {};
for (const [id, prefab] of Object.entries(prefabs)) {
  if (!prefab.actions) continue;
  for (const action of prefab.actions) {
    const key = actionToShortcutKey(action);
    const remap = wc3CommonRemaps[key];
    if (remap) {
      (wc3ActionOverrides[id] ??= {})[key] = remap;
    }
  }
}

const wc3Overrides: PresetOverrides = {
  useSlotBindings: true,
  clearOrderOnRightClick: true,
  bindings: {
    ...wc3ActionOverrides,
    misc: {
      applyZoom: ["Backquote"],
    },
    sheep: {
      ...wc3ActionOverrides.sheep,
      "stop~1": ["KeyH"],
      "build-monolith": ["KeyX"],
      bite: ["KeyA"],
    },
    wolf: {
      ...wc3ActionOverrides.wolf,
      dodge: ["KeyE"],
      "menu-shop": ["KeyQ"],
      "shop.purchase-foxToken": ["KeyQ"],
      "shop.purchase-speedPot": ["KeyW"],
      "shop.purchase-strengthPotion": ["KeyE"],
      "shop.purchase-beam": ["KeyR"],
      "shop.purchase-bomber": ["KeyS"],
      "shop.purchase-boots": ["KeyZ"],
      "shop.purchase-hayTrap": ["KeyX"],
      "shop.purchase-swiftness": ["KeyF"],
      "shop.purchase-scythe": ["KeyV"],
    },
  },
  menus: [
    {
      id: "build-wc3",
      name: "Build",
      icon: "construction",
      prefabs: ["sheep"],
      binding: ["KeyB"],
      actions: [
        { type: "action", actionKey: "back" },
        ...sheepBuildActions,
      ],
    },
  ],
};

export const presetOverrides: Record<Preset, PresetOverrides> = {
  est: {
    bindings: {},
    menus: [],
    useSlotBindings: false,
    clearOrderOnRightClick: false,
  },
  wc3: wc3Overrides,
};
