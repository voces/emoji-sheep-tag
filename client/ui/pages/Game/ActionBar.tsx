import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { selection } from "../../../systems/autoSelect.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { playersVar, useLocalPlayer } from "@/vars/players.ts";
import { shortcutsVar } from "../Settings.tsx";
import { useListenToEntityProp } from "@/hooks/useListenToEntityProp.ts";
import { getCurrentMenu, menuStateVar } from "@/vars/menuState.ts";
import { useMemo } from "react";
import { Action } from "./Action.tsx";

export const selectionVar = makeVar<Entity | undefined>(undefined);
selection.addEventListener(
  "add",
  (e) => selectionVar((v) => v?.selected && app.entities.has(v) ? v : e),
);
selection.addEventListener(
  "delete",
  (e) =>
    selectionVar((v) =>
      v !== e && v?.selected && app.entities.has(v) ? v : selection.first()
    ),
);

export const ActionBar = () => {
  const selection = useReactiveVar(selectionVar);
  useReactiveVar(shortcutsVar);
  useReactiveVar(menuStateVar);
  const currentMenu = getCurrentMenu();
  useListenToEntityProp(selection, "order");
  useListenToEntityProp(selection, "mana");
  useListenToEntityProp(selection, "inventory");
  const localPlayer = useLocalPlayer();

  // Listen to gold changes on the owning player's entity
  const owningPlayer = selection
    ? playersVar().find((p) => p.id === selection.owner)
    : undefined;
  useListenToEntityProp(owningPlayer?.entity, "gold");

  // Show menu actions if menu is active
  let displayActions = currentMenu
    ? currentMenu.action.actions
    : selection?.actions ?? [];

  // Add item actions from inventory
  if (!currentMenu && selection?.inventory) {
    const itemActions: UnitDataAction[] = [];
    for (const item of selection.inventory) {
      if (item.actions && (item.charges == null || item.charges > 0)) {
        for (const itemAction of item.actions) {
          // Create an action with the charge count in the name if applicable
          const actionWithCharges = {
            ...itemAction,
            name: item.charges
              ? `${itemAction.name} (${item.charges})`
              : itemAction.name,
          };
          itemActions.push(actionWithCharges);
        }
      }
    }
    displayActions = [...displayActions, ...itemActions];
  }

  const currentActionCheck = useMemo(
    () => (action: UnitDataAction) =>
      !!selection &&
      (action.type === "build"
        ? selection.order?.type === "build" &&
          selection.order.unitType === action.unitType
        : action.type === "auto"
        ? action.order ===
          (selection.order?.type === "cast"
            ? selection.order.orderId
            : selection.order?.type === "hold"
            ? "hold"
            : !selection.order
            ? "stop"
            : undefined)
        : action.type === "target"
        ? action.order === "attack"
          ? selection.order?.type === "attack" ||
            (selection.order?.type === "attackMove")
          : action.order === "move" && !!selection.order &&
            "path" in selection.order
        : action.type === "purchase"
        ? false // Purchase actions are instant, never current
        : action.type === "menu"
        ? !!(currentMenu && currentMenu.action === action)
        : false),
    [selection, currentMenu],
  );

  if (!selection || selection.owner !== localPlayer?.id) return null;

  return (
    <div
      role="toolbar"
      className="card h-stack hide-empty"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        gap: 10,
        padding: 12,
      }}
    >
      {displayActions.map((action, i) => (
        <Action
          key={i}
          action={action}
          entity={selection}
          current={currentActionCheck(action)}
        />
      ))}
    </div>
  );
};
