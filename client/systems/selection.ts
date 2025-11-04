import { Entity, SystemEntity } from "../ecs.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { cancelOrder } from "../controls.ts";
import { selectEntity } from "../api/selection.ts";
import { camera } from "../graphics/three.ts";
import { applyZoom, isLocalPlayer } from "../api/player.ts";
import { addSystem } from "@/shared/context.ts";
import type { Buff } from "@/shared/types.ts";

// X'd farms not removed from selection
export const selection = new ExtendedSet<SystemEntity<"selected">>();

let primary: Entity | undefined;
export const getPrimaryUnit = () => primary;

export const foxes = new ExtendedSet<Entity>();
export const mirrors = new ExtendedSet<Entity>();

// Client-only selection indicator buff
const SELECTION_BUFF: Buff = {
  model: "glow",
  modelScale: 1,
};

const selectionBuffs = new Map<Entity, Buff>();

const addSelectionBuff = (e: Entity) => {
  const buff: Buff = {
    ...SELECTION_BUFF,
    modelScale: (e.radius ?? 0.25) * 4 / (e.modelScale ?? 1) + 0.1,
  };
  e.buffs = [...e.buffs ?? [], buff];
  selectionBuffs.set(e, buff);
};

const removeSelectionBuff = (e: Entity) => {
  const tracked = selectionBuffs.get(e);
  if (tracked) {
    selectionBuffs.delete(e);
    e.buffs = e.buffs?.filter((b) => b !== tracked);
  }
};

// Selection glow + auto reselect + canceling actions on blur
addSystem({
  props: ["selected"],
  entities: selection,
  onAdd: addSelectionBuff,
  onRemove: (e) => {
    removeSelectionBuff(e);
    cancelOrder((order, blueprint) =>
      !selection.some((s) =>
        s.actions?.some((a) =>
          (a.type === "build" && a.unitType === blueprint) ||
          (a.type === "target" && a.order === order)
        )
      )
    );
    if (!selection.size && primary) {
      queueMicrotask(() => !selection.size && primary && selectEntity(primary));
    }
  },
});

// Restore selection buff when server updates buffs on selected entities
const readdBuff = (e: Entity) => {
  const tracked = selectionBuffs.get(e);
  if (!tracked) return;

  const hasSelectionBuff = e.buffs?.some((b) => b === tracked);
  if (!hasSelectionBuff) e.buffs = [...e.buffs ?? [], tracked];
};
addSystem({ props: ["buffs"], onChange: readdBuff, onRemove: readdBuff });

// Auto select unit
addSystem({
  props: ["prefab", "owner"],
  onAdd: (e) => {
    if (!isLocalPlayer(e.owner)) return;

    if (e.prefab === "sheep" || e.prefab === "wolf" || e.prefab === "spirit") {
      if (selection.size === 0) {
        selectEntity(e);
        if (e.position) {
          camera.position.x = e.position.x;
          camera.position.y = e.position.y;
        }
      }
      if (!primary) {
        primary = e;
        applyZoom();
      }
    }

    if (e.prefab === "wolf" && e.isMirror) mirrors.add(e);
    if (e.prefab === "fox") foxes.add(e);
  },
  onRemove: (e) => {
    if (e === primary) primary = undefined;
    mirrors.delete(e);
    foxes.delete(e);
  },
});
