import { SystemEntity } from "../ecs.ts";
import { addSystem } from "@/shared/context.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { actionToShortcutKey } from "../util/actionToShortcutKey.ts";

const shortcutOverrides = (e: SystemEntity<"prefab" | "actions">) => {
  const shortcuts = shortcutsVar()[e.prefab];
  if (!shortcuts) return e;
  let overridden = false;

  const overrideAction = (
    action: UnitDataAction,
    menuContext?: string,
  ): UnitDataAction => {
    const shortcutKey = actionToShortcutKey(action, menuContext);
    const binding = shortcuts[shortcutKey];

    let updatedAction = action;

    if (
      binding && (
        !action.binding ||
        action.binding.length !== binding.length ||
        !action.binding.every((v, i) => v === binding[i])
      )
    ) {
      overridden = true;
      updatedAction = { ...action, binding };
    }

    if (updatedAction.type === "menu") {
      const menuName = actionToShortcutKey(updatedAction);
      const menuAction = updatedAction as UnitDataAction & { type: "menu" };
      const updatedSubActions = menuAction.actions.map((subAction) =>
        overrideAction(subAction, menuName)
      );

      if (
        updatedSubActions.some((newSub, i) => newSub !== menuAction.actions[i])
      ) {
        overridden = true;
        updatedAction = { ...menuAction, actions: updatedSubActions };
      }
    }

    return updatedAction;
  };

  const newActions = e.actions.map((action) => overrideAction(action));
  if (!overridden) return;
  e.actions = newActions;
};

const entities = new Set<SystemEntity<"prefab" | "actions">>();
addSystem({
  entities,
  props: ["prefab", "actions"],
  onAdd: shortcutOverrides,
  onChange: shortcutOverrides,
});

shortcutsVar.subscribe(() => {
  for (const e of entities) shortcutOverrides(e);
});
