import type { Preset } from "./shortcutSettings.ts";
import type { MenuActionRef, MenuConfig } from "./menus.ts";
import { prefabs } from "@/shared/data.ts";

export type PresetOverrides = {
  bindings: Record<string, Record<string, string[]>>;
  menus: MenuConfig[];
  useSlotBindings?: boolean;
  clearOrderOnRightClick?: boolean;
};

const sheepBuildActions: MenuActionRef[] = (prefabs.sheep?.actions ?? [])
  .filter((a) => a.type === "build")
  .map((a) => ({ type: "action", actionKey: `build-${a.unitType}` }));

const wc3Overrides: PresetOverrides = {
  useSlotBindings: true,
  clearOrderOnRightClick: true,
  bindings: {
    misc: {
      applyZoom: ["Backquote"],
    },
    sheep: {
      move: ["KeyM"],
      stop: ["KeyS"],
      selfDestruct: ["KeyD"],
      "build-monolith": ["KeyX"],
      bite: ["KeyA"],
    },
    wolf: {
      move: ["KeyM"],
      stop: ["KeyS"],
      selfDestruct: ["KeyD"],
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
