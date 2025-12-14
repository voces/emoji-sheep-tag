import { makeVar } from "@/hooks/useVar.tsx";
import { UnitDataAction } from "@/shared/types.ts";

interface MenuStackItem {
  action: UnitDataAction & { type: "menu" };
  unitId: string;
}

interface MenuState {
  stack: MenuStackItem[];
}

export const menuStateVar = makeVar<MenuState>({ stack: [] });

export const openMenu = (
  menuAction: UnitDataAction & { type: "menu" },
  unitId: string,
) => {
  menuStateVar((state) => ({
    stack: [...state.stack, { action: menuAction, unitId }],
  }));
};

export const closeMenu = () => {
  menuStateVar((state) => ({
    stack: state.stack.slice(0, -1),
  }));
};

export const closeAllMenus = () => {
  menuStateVar({ stack: [] });
};

// Batch closeMenusForUnit calls to avoid React update cascades
let pendingCloseUnitIds: Set<string> | null = null;

export const closeMenusForUnit = (unitId: string) => {
  if (!pendingCloseUnitIds) {
    pendingCloseUnitIds = new Set();
    // Use setTimeout(0) instead of queueMicrotask to defer until after React's render cycle
    setTimeout(() => {
      const unitIds = pendingCloseUnitIds!;
      pendingCloseUnitIds = null;
      menuStateVar((state) => ({
        stack: state.stack.filter((item) => !unitIds.has(item.unitId)),
      }));
    }, 0);
  }
  pendingCloseUnitIds.add(unitId);
};

export const getCurrentMenu = () => {
  const state = menuStateVar();
  return state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;
};
