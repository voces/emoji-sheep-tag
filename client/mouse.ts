import { TypedEventTarget } from "typed-event-target";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { camera, scene } from "./graphics/three.ts";
import { InstancedSvg } from "./graphics/InstancedSvg.ts";
import { AnimatedInstancedMesh } from "./graphics/AnimatedInstancedMesh.ts";
import { Entity } from "./ecs.ts";
import { lookup } from "./systems/lookup.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { isQueueModifierHeld } from "./controls/keyboardHandlers.ts";
import { editorVar } from "@/vars/editor.ts";
import { addSystem } from "@/shared/context.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { isTauri } from "./isTauri.ts";

export type MouseButton = "left" | "right" | "middle";

export const mouseButtonFromIndex = (index: number): MouseButton =>
  index === 0 ? "left" : index === 1 ? "middle" : "right";

export const mouseButtonIndex = (button: MouseButton) =>
  button === "left" ? 0 : button === "middle" ? 1 : 2;

export class MouseEvent extends Event {
  readonly pixels: Vector2;
  readonly percent: Vector2;
  readonly world: Vector2;
  readonly angle: number;
  readonly intersects: ExtendedSet<Entity>;
  readonly queue: boolean;
  #element: Element | null | undefined;
  #elements: Element[] | undefined;

  constructor(name: string) {
    super(name);

    this.pixels = mouse.pixels.clone();
    this.percent = mouse.percent.clone();
    this.world = mouse.world.clone();
    this.angle = mouse.angle;
    // mouse.intersects is replaced, never mutated, so the event can share it
    this.intersects = mouse.intersects;
    this.queue = isQueueModifierHeld();
  }

  get element(): Element | null {
    if (this.#element === undefined) {
      this.#element = document.elementFromPoint(this.pixels.x, this.pixels.y);
    }
    return this.#element;
  }

  get elements(): Element[] {
    return this.#elements ??= document.elementsFromPoint(
      this.pixels.x,
      this.pixels.y,
    );
  }
}

export class MouseButtonEvent extends MouseEvent {
  readonly hadActiveOrder: boolean;
  readonly hadBlueprint: boolean;

  constructor(
    direction: "up" | "down",
    readonly button: MouseButton,
  ) {
    super(`mouseButton${direction[0].toUpperCase() + direction.slice(1)}`);

    this.hadActiveOrder = mouse.getActiveOrder?.() !== undefined;
    this.hadBlueprint = mouse.getBlueprint?.() !== undefined;
  }
}

export class MouseMoveEvent extends MouseEvent {
  constructor() {
    super("mouseMove");
  }
}

export class IntersectsChangeEvent extends MouseEvent {
  constructor() {
    super("intersectsChange");
  }
}

type MouseEvents = {
  mouseButtonDown: MouseButtonEvent;
  mouseButtonUp: MouseButtonEvent;
  mouseMove: MouseMoveEvent;
  intersectsChange: IntersectsChangeEvent;
};

class MouseEventTarget extends TypedEventTarget<MouseEvents> {}

type Mouse = {
  pixels: Vector2;
  percent: Vector2;
  world: Vector2;
  angle: number;
  intersects: ExtendedSet<Entity>;
  customRaycast?: (
    x: number,
    y: number,
  ) => { intersects: ExtendedSet<Entity>; world: Vector2 } | null;
  getActiveOrder?: () =>
    | { order: string; variant: string; aoe?: number }
    | undefined;
  getBlueprint?: () => { prefab: string } | undefined;
};

export const mouse: MouseEventTarget & Mouse = Object.assign(
  new MouseEventTarget(),
  {
    pixels: new Vector2(globalThis.innerWidth / 2, globalThis.innerHeight / 2),
    percent: new Vector2(0.5, 0.5),
    world: new Vector2(),
    angle: 0,
    intersects: new ExtendedSet<Entity>(),
    customRaycast: undefined,
  },
);

const raycaster = new Raycaster();
raycaster.layers.set(0);

const cameraSpace = new Vector2();

const plane = new Plane(new Vector3(0, 0, 1), 0);

const world3 = new Vector3();

const screenRaycaster = new Raycaster();
const screenSpace = new Vector2();
const screenWorld3 = new Vector3();

/** Projects a viewport pixel onto the ground plane (z = 0). */
export const screenToWorld = (x: number, y: number, target = new Vector2()) => {
  screenSpace.x = (x / globalThis.innerWidth) * 2 - 1;
  screenSpace.y = -(y / globalThis.innerHeight) * 2 + 1;
  screenRaycaster.setFromCamera(screenSpace, camera);
  screenRaycaster.ray.intersectPlane(plane, screenWorld3);
  return target.set(screenWorld3.x, screenWorld3.y);
};

let lastIntersectUpdate = performance.now() / 1000;

const setsEqual = (a: ExtendedSet<Entity>, b: ExtendedSet<Entity>) => {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
};

const updateIntersects = () => {
  lastIntersectUpdate = performance.now() / 1000;
  const prevIntersects = mouse.intersects;

  if (mouse.customRaycast) {
    const result = mouse.customRaycast(mouse.pixels.x, mouse.pixels.y);
    if (result) {
      mouse.intersects = result.intersects;
      mouse.world.copy(result.world);
      mouse.angle = Math.atan2(
        result.world.y - camera.position.y,
        result.world.x - camera.position.x,
      );
      if (!setsEqual(prevIntersects, mouse.intersects)) {
        mouse.dispatchTypedEvent(
          "intersectsChange",
          new IntersectsChangeEvent(),
        );
      }
      return;
    }
  }

  raycaster.layers.set(0);
  if (editorVar()) raycaster.layers.enable(2);
  const intersects = raycaster.intersectObject(scene, true);
  if (intersects.length) {
    const set = new ExtendedSet<Entity>();
    for (const intersect of intersects) {
      if (typeof intersect.instanceId !== "number") continue;
      const obj = intersect.object;
      if (
        !(obj instanceof InstancedSvg) &&
        !(obj instanceof AnimatedInstancedMesh)
      ) continue;
      const id = obj.getId(intersect.instanceId);
      if (!id) continue;
      const entity = lookup(id);
      if (!entity || (!editorVar() && entity.isDoodad)) continue;
      // Filter out entities hidden by fog (but allow in editor mode)
      if (entity.hiddenByFog && !editorVar()) continue;
      // Never allow picking effect entities (glow, birds, etc.)
      if (entity.isEffect) continue;
      set.add(entity);
    }
    if (set.size || mouse.intersects.size) mouse.intersects = set;
  } else if (mouse.intersects.size) mouse.intersects = new ExtendedSet();

  raycaster.ray.intersectPlane(plane, world3);
  mouse.world.x = world3.x;
  mouse.world.y = world3.y;

  if (!setsEqual(prevIntersects, mouse.intersects)) {
    mouse.dispatchTypedEvent("intersectsChange", new IntersectsChangeEvent());
  }
};

// A small inset "wall": the visible game cursor stops a few px short of the edge
// (matching the old pointer-lock feel). Edge-pan still triggers (<=12px).
const CURSOR_INSET = 8;
const clampPixel = (value: number, max: number) =>
  Math.max(CURSOR_INSET, Math.min(value, max - CURSOR_INSET));

const commitMouseMove = () => {
  mouse.percent.x = mouse.pixels.x / globalThis.innerWidth;
  mouse.percent.y = mouse.pixels.y / globalThis.innerHeight;
  cameraSpace.x = mouse.percent.x * 2 - 1;
  cameraSpace.y = mouse.percent.y * -2 + 1;

  raycaster.setFromCamera(cameraSpace, camera);
  updateIntersects();

  mouse.dispatchTypedEvent("mouseMove", new MouseMoveEvent());
};

// Pointer moves only record pixels; the raycast and mouseMove dispatch happen
// at most once per frame, or sooner when a button or key needs fresh state.
let movePending = false;

const flushMouseMove = () => {
  if (!movePending) return;
  movePending = false;
  commitMouseMove();
};

// While raw mouse input is active (Windows desktop), the cursor is driven by raw
// deltas (rawMouse.ts) and we ignore the OS pointer position entirely.
let rawMouseActive = false;
export const setRawMouseActive = (active: boolean) => {
  rawMouseActive = active;
};

/** Move the simulated cursor by a raw delta (scaled by sensitivity), clamped to
 * the viewport, then run the usual mouse-move pipeline. */
export const applyRawMouseDelta = (dx: number, dy: number) => {
  const sensitivity = gameplaySettingsVar().mouseSensitivity;
  mouse.pixels.x = clampPixel(
    mouse.pixels.x + dx * sensitivity,
    globalThis.innerWidth,
  );
  mouse.pixels.y = clampPixel(
    mouse.pixels.y + dy * sensitivity,
    globalThis.innerHeight,
  );
  // Raw deltas are already polled once per frame, so commit them straight away
  movePending = true;
  flushMouseMove();
};

globalThis.addEventListener("pointermove", (event) => {
  if (rawMouseActive) return;
  // Browser pointer lock gives no absolute position, so accumulate relative
  // deltas. In Tauri (without raw input) we confine the real cursor and use its
  // absolute position directly.
  if (document.pointerLockElement && !isTauri) {
    const sensitivity = gameplaySettingsVar().mouseSensitivity;
    mouse.pixels.x = clampPixel(
      mouse.pixels.x + event.movementX * sensitivity,
      globalThis.innerWidth,
    );
    mouse.pixels.y = clampPixel(
      mouse.pixels.y + event.movementY * sensitivity,
      globalThis.innerHeight,
    );
  } else if (isTauri) {
    mouse.pixels.x = clampPixel(event.clientX, globalThis.innerWidth);
    mouse.pixels.y = clampPixel(event.clientY, globalThis.innerHeight);
  } else {
    mouse.pixels.x = event.clientX;
    mouse.pixels.y = event.clientY;
  }
  movePending = true;
});

globalThis.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  flushMouseMove();
  mouse.dispatchTypedEvent(
    "mouseButtonDown",
    new MouseButtonEvent("down", mouseButtonFromIndex(event.button)),
  );
});

globalThis.addEventListener("pointerup", (event) => {
  flushMouseMove();
  mouse.dispatchTypedEvent(
    "mouseButtonUp",
    new MouseButtonEvent("up", mouseButtonFromIndex(event.button)),
  );
});

// Key handlers read mouse.world (build/ping at cursor), so bring it up to date
globalThis.addEventListener("keydown", flushMouseMove, { capture: true });

globalThis.addEventListener("contextmenu", (e) => e.preventDefault());

// Handle wheel events for the simulated cursor position during pointer lock
globalThis.addEventListener(
  "wheel",
  (event) => {
    if (!document.pointerLockElement) return;
    if (!event.isTrusted) return; // Ignore synthetic events we dispatch

    event.preventDefault();
    event.stopImmediatePropagation();

    // Find the element at the simulated cursor position
    const target = document.elementFromPoint(mouse.pixels.x, mouse.pixels.y);
    if (!target) return;

    // Dispatch a synthetic wheel event to give handlers a chance to respond
    const syntheticEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: mouse.pixels.x,
      clientY: mouse.pixels.y,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
    });
    target.dispatchEvent(syntheticEvent);

    // If a handler called preventDefault, don't manually scroll
    if (syntheticEvent.defaultPrevented) return;

    // Manually scroll since synthetic events don't trigger default behavior
    const elements = document.elementsFromPoint(mouse.pixels.x, mouse.pixels.y);
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue;

      const style = getComputedStyle(element);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const canScrollY = (overflowY === "auto" || overflowY === "scroll") &&
        element.scrollHeight > element.clientHeight;
      const canScrollX = (overflowX === "auto" || overflowX === "scroll") &&
        element.scrollWidth > element.clientWidth;

      if (canScrollY || canScrollX) {
        if (canScrollY) element.scrollTop += event.deltaY;
        if (canScrollX) element.scrollLeft += event.deltaX;
        return;
      }
    }
  },
  { passive: false },
);

addSystem({
  update: (_, time) => {
    if (movePending) flushMouseMove();
    else if (time - lastIntersectUpdate > 0.2) updateIntersects();
  },
});
