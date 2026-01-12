import { useEffect, useState } from "react";
import { mouse, MouseButtonEvent } from "../../../../mouse.ts";

export type DragData = {
  actionKey: string;
  section: string;
  fromMenu: string | null;
};

type DropHandler = (data: DragData) => void;

// Global drag state shared across all shortcut rows
let currentDrag: DragData | null = null;
let isDragging = false; // True once mouse moves after mousedown
const listeners = new Set<() => void>();
const dropTargets = new Map<
  string,
  { element: HTMLElement; handler: DropHandler }
>();

const notifyListeners = () => listeners.forEach((l) => l());

export const startDrag = (data: DragData) => {
  currentDrag = data;
  isDragging = false; // Will become true on first mousemove
  notifyListeners();
};

export const endDrag = () => {
  currentDrag = null;
  isDragging = false;
  notifyListeners();
};

export const getDragData = () => currentDrag;
export const getIsDragging = () => isDragging;

export const registerDropTarget = (
  id: string,
  element: HTMLElement,
  handler: DropHandler,
) => {
  dropTargets.set(id, { element, handler });
  return () => {
    dropTargets.delete(id);
  };
};

// Cancel drag on Escape key
globalThis.addEventListener?.("keydown", (e) => {
  if (e.key === "Escape" && currentDrag) {
    endDrag();
  }
});

// Track which drop target we're currently over
let currentDropTarget: string | null = null;

// Track mouse movement and trigger drops on hover
mouse.addEventListener("mouseMove", () => {
  if (!currentDrag) return;

  const wasNotDragging = !isDragging;
  isDragging = true;

  // Find all matching drop targets
  const matches: Array<{ id: string; handler: DropHandler; area: number }> = [];

  for (const [id, { element, handler }] of dropTargets) {
    const rect = element.getBoundingClientRect();
    if (
      mouse.pixels.x >= rect.left &&
      mouse.pixels.x <= rect.right &&
      mouse.pixels.y >= rect.top &&
      mouse.pixels.y <= rect.bottom
    ) {
      const area = rect.width * rect.height;
      matches.push({ id, handler, area });
    }
  }

  // Prefer menu targets over section targets when both match
  // (menus are nested inside sections, so prefer the more specific target)
  // Among same type, prefer smallest
  let newTarget: string | null = null;
  let newTargetHandler: DropHandler | null = null;

  const menuMatches = matches.filter((m) => m.id.startsWith("menu-"));
  const sectionMatches = matches.filter((m) => m.id.startsWith("section-"));

  if (menuMatches.length > 0) {
    // Pick smallest menu
    menuMatches.sort((a, b) => a.area - b.area);
    newTarget = menuMatches[0].id;
    newTargetHandler = menuMatches[0].handler;
  } else if (sectionMatches.length > 0) {
    // Pick smallest section (usually just one)
    sectionMatches.sort((a, b) => a.area - b.area);
    newTarget = sectionMatches[0].id;
    newTargetHandler = sectionMatches[0].handler;
  }

  // Trigger drop when entering a new target
  if (currentDropTarget !== newTarget) {
    // If we left a menu and are now in any section (even a different one),
    // we need to remove the action from its current menu
    const leftMenu = currentDropTarget?.startsWith("menu-");
    const nowInSection = newTarget?.startsWith("section-");

    if (leftMenu && nowInSection && currentDrag.fromMenu) {
      // Find the section handler that matches the action's section
      const actionSectionTarget = matches.find(
        (m) => m.id === `section-${currentDrag!.section}`,
      );
      if (actionSectionTarget) {
        actionSectionTarget.handler(currentDrag);
      }
      currentDrag.fromMenu = null;
    } else if (newTarget !== null && newTargetHandler) {
      newTargetHandler(currentDrag);
      // Update fromMenu to reflect the new location
      if (newTarget.startsWith("menu-")) {
        currentDrag.fromMenu = newTarget.substring(5);
      } else if (newTarget.startsWith("section-")) {
        currentDrag.fromMenu = null;
      }
    }
  }

  // Only notify React when drop target changes or drag just started
  if (currentDropTarget !== newTarget || wasNotDragging) {
    currentDropTarget = newTarget;
    notifyListeners();
  } else {
    currentDropTarget = newTarget;
  }
});

// Handle mouseup - just end the drag
mouse.addEventListener("mouseButtonUp", (e: MouseButtonEvent) => {
  if (!currentDrag) return;
  if (e.button !== "left") return;
  currentDropTarget = null;
  endDrag();
});

export const getCurrentDropTarget = () => currentDropTarget;

export const useDragState = () => {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return currentDrag;
};

// Only re-renders when drag state changes for this specific section
export const useSectionDragState = (section: string) => {
  const [state, setState] = useState<{
    isDragging: boolean;
    draggedAction: string | null;
    activeDropTarget: string | null;
  }>({ isDragging: false, draggedAction: null, activeDropTarget: null });

  useEffect(() => {
    const listener = () => {
      const isDragging = currentDrag !== null &&
        currentDrag.section === section;
      const draggedAction = currentDrag?.section === section
        ? currentDrag.actionKey
        : null;
      const activeDropTarget = isDragging ? currentDropTarget : null;

      setState((prev) => {
        if (
          prev.isDragging === isDragging &&
          prev.draggedAction === draggedAction &&
          prev.activeDropTarget === activeDropTarget
        ) {
          return prev; // No change, don't trigger re-render
        }
        return { isDragging, draggedAction, activeDropTarget };
      });
    };
    listeners.add(listener);
    // Initial state
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, [section]);

  return state;
};
