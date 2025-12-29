import { Entity, SystemEntity } from "../ecs.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { cancelOrder } from "../controls.ts";
import { selectEntity } from "../api/selection.ts";
import { camera, onRender } from "../graphics/three.ts";
import { getLocalPlayer, isLocalPlayer } from "../api/player.ts";
import { addSystem } from "@/shared/context.ts";
import type { Buff } from "@/shared/types.ts";
import { send } from "../messaging.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { Color } from "three";
import { primaryUnitVar } from "@/vars/primaryUnit.ts";
import { startFollowingEntity, stopFollowingEntity } from "../api/camera.ts";

// X'd farms not removed from selection
export const selection = new ExtendedSet<SystemEntity<"selected">>();

export const foxes = new ExtendedSet<Entity>();
export const mirrors = new ExtendedSet<Entity>();

// Client-only selection indicator buff
const SELECTION_BUFF: Buff = {
  model: "glow",
  modelScale: 1,
};

const selectionBuffs = new Map<Entity, Buff>();

const updateSelectionBuff = (e: Entity) => {
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return;

  const oldBuff = selectionBuffs.get(e);

  if (e.prefab === "startLocation") {
    if (oldBuff) {
      e.buffs = e.buffs?.filter((b) => b !== oldBuff);
      selectionBuffs.delete(e);
    }
    return;
  }

  // Collect all selecting player colors (including local player if selected)
  const selectingColors: string[] = [];

  // Add local player color if this entity is selected
  if (e.selected && localPlayer.playerColor) {
    selectingColors.push(localPlayer.playerColor);
  }

  // Add allied player colors from selectedBy
  const selectedBy = e.selectedBy ?? [];
  for (const playerId of selectedBy) {
    if (playerId === localPlayer.id) continue; // Already handled above
    if (!isAlly(playerId, localPlayer.id)) continue;

    const playerEntity = getPlayer(playerId);
    if (playerEntity?.playerColor) {
      selectingColors.push(playerEntity.playerColor);
    }
  }

  // Remove old buff if it exists
  if (oldBuff) {
    e.buffs = e.buffs?.filter((b) => b !== oldBuff);
    selectionBuffs.delete(e);
  }

  // If there are any selections, create a buff with combined color
  if (selectingColors.length > 0) {
    // Average the colors using Three.js Color
    const combinedColor = new Color(0, 0, 0);
    for (const colorStr of selectingColors) {
      combinedColor.add(new Color(colorStr));
    }
    combinedColor.multiplyScalar(1 / selectingColors.length);

    const buff: Buff = {
      ...SELECTION_BUFF,
      modelScale: (e.radius ?? 0.25) * 4 / (e.modelScale ?? 1) + 0.1,
      modelAlpha: e.selected ? 1 : 0.5, // Full opacity for local selection
      modelPlayerColor: "#" + combinedColor.getHexString(),
    };
    e.buffs = [...e.buffs ?? [], buff];
    selectionBuffs.set(e, buff);
  }
};

// Track selection changes and send to server
const sendSelectionUpdate = () => {
  const entityIds = Array.from(selection).map((e) => e.id);
  send({ type: "updateSelection", entityIds });
};

// Selection glow + auto reselect + canceling actions on blur
addSystem({
  props: ["selected"],
  entities: selection,
  onAdd: (e) => {
    updateSelectionBuff(e);
    sendSelectionUpdate();
  },
  onRemove: (e) => {
    updateSelectionBuff(e);
    sendSelectionUpdate();
    cancelOrder((order, blueprint) =>
      !selection.some((s) =>
        s.actions?.some((a) =>
          (a.type === "build" && a.unitType === blueprint) ||
          (a.type === "target" && a.order === order)
        )
      )
    );
    const primaryUnit = primaryUnitVar();
    if (!selection.size && primaryUnit) {
      queueMicrotask(() =>
        !selection.size && primaryUnitVar() && selectEntity(primaryUnitVar()!)
      );
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

// Fade selection glow from 1.0 to 0.5 over 10 seconds using delta time
onRender((delta) => {
  for (const [entity, buff] of selectionBuffs) {
    const currentAlpha = buff.modelAlpha ?? 1;
    if (currentAlpha > 0.5) {
      // Decrease alpha by 0.05 per second (0.5 / 10 seconds)
      const newAlpha = Math.max(0.5, currentAlpha - delta * 0.05);
      const newBuff: Buff = { ...buff, modelAlpha: newAlpha };
      selectionBuffs.set(entity, newBuff);

      // Replace buff in entity's buffs array
      const buffs = entity.buffs;
      if (buffs) {
        const index = buffs.indexOf(buff);
        if (index !== -1) {
          entity.buffs = [
            ...buffs.slice(0, index),
            newBuff,
            ...buffs.slice(index + 1),
          ];
        }
      }
    }
  }
});

// Update selection buff when selectedBy changes
addSystem({
  props: ["selectedBy"],
  onAdd: updateSelectionBuff,
  onChange: updateSelectionBuff,
  onRemove: updateSelectionBuff,
});

// Auto select unit
addSystem({
  props: ["prefab", "owner"],
  onAdd: (e) => {
    if (!isLocalPlayer(e.owner)) return;

    // Start locations: select, center camera, and follow
    if (e.prefab === "startLocation") {
      selectEntity(e);
      startFollowingEntity(e);
      if (!primaryUnitVar()) primaryUnitVar(e);
    } else if (e.prefab === "sheep") {
      // Sheep: select, center camera, stop following start location
      stopFollowingEntity();
      selectEntity(e);
      if (e.position) {
        camera.position.x = e.position.x;
        camera.position.y = e.position.y;
      }
      if (!primaryUnitVar()) primaryUnitVar(e);
    } else if (e.prefab === "wolf" || e.prefab === "spirit") {
      // Required to prevent selecting mirrors
      if (selection.size === 0) {
        selectEntity(e);
        if (e.position) {
          camera.position.x = e.position.x;
          camera.position.y = e.position.y;
        }
      }
      if (!primaryUnitVar()) primaryUnitVar(e);
    }

    if (e.prefab === "wolf" && e.isMirror) mirrors.add(e);
    if (e.prefab === "fox") foxes.add(e);
  },
  onRemove: (e) => {
    if (e === primaryUnitVar()) primaryUnitVar(undefined);
    if (e.prefab === "startLocation") stopFollowingEntity();
    mirrors.delete(e);
    foxes.delete(e);
  },
});
