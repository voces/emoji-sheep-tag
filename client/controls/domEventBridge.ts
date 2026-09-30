import {
  MouseButtonEvent,
  mouseButtonIndex,
  MouseMoveEvent,
} from "../mouse.ts";

/** Checks if an element should pass through clicks to the game canvas */
export const isGameElement = (element: Element | null): boolean => {
  if (!element) return false;
  const gameUiAncestor = element.closest("[data-game-ui]");
  return gameUiAncestor !== null &&
    (gameUiAncestor === element || gameUiAncestor.id !== "ui");
};

// Simulated :active state
const actives: Element[] = [];
const clearActives = () => {
  for (const el of actives) el.classList.remove("active");
  actives.length = 0;
};

/**
 * Forwards a simulated mouse press to the UI element under the cursor. Returns
 * true when that element consumes the press, so the game should ignore it.
 */
export const bridgeMouseDown = (e: MouseButtonEvent): boolean => {
  // Handle focus/blur for UI elements
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== e.element
  ) document.activeElement.blur();

  if (
    (e.element instanceof HTMLElement || e.element instanceof SVGElement)
  ) {
    const passThrough = isGameElement(e.element);
    if (!passThrough) e.element.focus();

    // Simulate :active on the element and its ancestors
    clearActives();
    for (
      let el: Element | null = e.element;
      el;
      el = el.parentElement
    ) {
      el.classList.add("active");
      actives.push(el);
    }

    e.element.dispatchEvent(
      new MouseEvent("mousedown", {
        view: window,
        bubbles: true,
        cancelable: true,
        button: mouseButtonIndex(e.button),
      }),
    );
    return !passThrough;
  }
  return false;
};

export const bridgeMouseUp = (e: MouseButtonEvent) => {
  clearActives();

  // Emit mouseup and click/contextmenu to UI elements
  // Only dispatch synthetic events when pointer lock is active; without it,
  // native browser events already reach the elements and dispatching would
  // double-fire.
  if (
    document.pointerLockElement &&
    (e.element instanceof HTMLElement || e.element instanceof SVGElement) &&
    !isGameElement(e.element)
  ) {
    e.element.dispatchEvent(
      new MouseEvent("mouseup", {
        view: window,
        bubbles: true,
        cancelable: true,
        button: mouseButtonIndex(e.button),
      }),
    );
    if (e.button === "right") {
      e.element.dispatchEvent(
        new MouseEvent("contextmenu", {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 2,
        }),
      );
    } else if ("click" in e.element) e.element.click();
    else {
      e.element.dispatchEvent(
        new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }
};

let hover: Element | null = null;
let hovers: Element[] = [];

export const bridgeMouseMove = (e: MouseMoveEvent) => {
  // Handle hover events
  if (hover !== e.element) {
    hover?.dispatchEvent(
      new MouseEvent("mouseout", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    e.element?.dispatchEvent(
      new MouseEvent("mouseover", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    hover = e.element;
  }

  // Handle hover classes
  // Find if there's an overlay in the element stack
  const overlayIndex = e.elements.findIndex((el) =>
    el instanceof HTMLElement && el.dataset.overlay === "true"
  );

  // Filter elements: if overlay exists, only keep elements before it (on top of overlay)
  const hoverableElements = overlayIndex >= 0
    ? e.elements.slice(0, overlayIndex)
    : e.elements;

  // Remove hover from elements no longer in the hoverable set
  for (const el of hovers) {
    if (!hoverableElements.includes(el)) el?.classList.remove("hover");
  }

  // Add hover to new hoverable elements
  for (const el of hoverableElements) {
    if (!hovers.includes(el)) el.classList.add("hover");
  }

  hovers = hoverableElements;
};
