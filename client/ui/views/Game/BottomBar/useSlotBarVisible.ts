import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import { shortcutSettingsVar } from "@/vars/shortcutSettings.ts";
import { selectionVar } from "./ActionBar.tsx";

export const useSlotBarVisible = () => {
  const { useSlotBindings } = useReactiveVar(shortcutSettingsVar);
  const selection = useReactiveVar(selectionVar);
  useListenToEntityProps(selection, ["inventory"]);

  if (!useSlotBindings || !selection?.inventory) return false;

  return selection.inventory.some((item) =>
    item.actions?.length && (item.charges == null || item.charges > 0)
  );
};
