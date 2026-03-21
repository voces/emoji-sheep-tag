import { Entity } from "../ecs.ts";
import { appContext } from "@/shared/context.ts";
import { selection } from "../systems/selection.ts";
import {
  clearSelection,
  selectAllFoxes,
  selectAllMirrors,
  selectEntity,
  selectPrimaryUnit,
} from "./selection.ts";
import { focusGroup } from "./camera.ts";
import { getLocalPlayer } from "./player.ts";
import { practiceVar } from "@/vars/practice.ts";
import { checkShortcut } from "../controls/keyboardHandlers.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";

const groups = new Map<number, Set<Entity>>();

const isFixedGroup = (group: number): boolean => {
  if (group === 1) return true;
  if (group === 2 || group === 3) {
    return getLocalPlayer()?.team === "wolf" || practiceVar();
  }
  return false;
};

const pruneGroup = (group: Set<Entity>): Set<Entity> => {
  const app = appContext.current;
  for (const entity of group) {
    if (!app.entities.has(entity)) group.delete(entity);
  }
  return group;
};

const assignGroup = (n: number, entities: Iterable<Entity>) => {
  if (isFixedGroup(n)) return;
  groups.set(n, new Set(entities));
};

const addToGroup = (n: number, entities: Iterable<Entity>) => {
  if (isFixedGroup(n)) return;
  const existing = groups.get(n) ?? new Set();
  for (const e of entities) existing.add(e);
  groups.set(n, existing);
};

const selectGroup = (n: number, additive: boolean) => {
  if (n === 1) {
    selectPrimaryUnit(!additive);
    return;
  }

  if (isFixedGroup(n)) {
    if (n === 2) selectAllMirrors(!additive);
    if (n === 3) selectAllFoxes(!additive);
    return;
  }

  const group = groups.get(n);
  if (!group) return;
  pruneGroup(group);
  if (group.size === 0) return;

  // Check if this group is already the exact selection (for focus-on-double-tap)
  const alreadySelected = group.size === selection.size &&
    [...group].every((e) => e.selected);

  if (alreadySelected && !additive) {
    focusGroup(group);
    return;
  }

  if (!additive) clearSelection();
  for (const entity of group) selectEntity(entity, false);
};

export const handleControlGroupKey = (e: KeyboardEvent): boolean => {
  const shortcuts = shortcutsVar();
  const cg = shortcuts.controlGroups;
  if (!cg) return false;

  for (let n = 0; n <= 9; n++) {
    const key = `group${n}`;
    if (!checkShortcut(cg, key, e.code)) continue;

    const isAssign = checkShortcut(cg, "assignModifier") > 0;
    const isAdditive =
      checkShortcut(shortcuts.misc, "addToSelectionModifier") > 0;

    if (isAssign && isAdditive) {
      addToGroup(n, selection);
    } else if (isAssign) {
      assignGroup(n, selection);
    } else {
      selectGroup(n, !!isAdditive);
    }

    e.preventDefault();
    return true;
  }

  return false;
};
