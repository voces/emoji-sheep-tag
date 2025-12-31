import { TypedEventTarget } from "typed-event-target";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { camera, scene } from "./graphics/three.ts";
import { InstancedSvg } from "./graphics/InstancedSvg.ts";
import { AnimatedInstancedMesh } from "./graphics/AnimatedInstancedMesh.ts";
import { Entity } from "./ecs.ts";
import { lookup } from "./systems/lookup.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { checkShortcut } from "./controls/keyboardHandlers.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { editorVar } from "@/vars/editor.ts";
import { addSystem } from "@/shared/context.ts";

export class MouseEvent extends Event {
  readonly pixels: Vector2;
  readonly percent: Vector2;
  readonly world: Vector2;
  readonly angle: number;
  readonly intersects: ExtendedSet<Entity>;
  readonly element: Element | null;
  readonly elements: Element[];
  readonly queue: boolean;

  constructor(name: string) {
    super(name);

    this.pixels = mouse.pixels.clone();
    this.percent = mouse.percent.clone();
    this.world = mouse.world.clone();
    this.angle = mouse.angle;
    this.intersects = new ExtendedSet(mouse.intersects);
    this.element = document.elementFromPoint(mouse.pixels.x, mouse.pixels.y);
    this.elements = document.elementsFromPoint(mouse.pixels.x, mouse.pixels.y);
    this.queue = checkShortcut(shortcutsVar().misc.queueModifier) > 0;
  }
}

export class MouseButtonEvent extends MouseEvent {
  readonly hadActiveOrder: boolean;
  readonly hadBlueprint: boolean;

  constructor(
    direction: "up" | "down",
    readonly button: "left" | "right" | "middle",
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
    | { order: string; variant: string; aoe: number }
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
      const entity = lookup[id];
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

globalThis.addEventListener("pointermove", (event) => {
  if (document.pointerLockElement) {
    mouse.pixels.x = Math.max(
      8,
      Math.min(mouse.pixels.x + event.movementX, globalThis.innerWidth - 8),
    );
    mouse.pixels.y = Math.max(
      8,
      Math.min(mouse.pixels.y + event.movementY, globalThis.innerHeight - 8),
    );
  } else {
    mouse.pixels.x = event.clientX;
    mouse.pixels.y = event.clientY;
  }
  mouse.percent.x = mouse.pixels.x / globalThis.innerWidth;
  mouse.percent.y = mouse.pixels.y / globalThis.innerHeight;
  cameraSpace.x = mouse.percent.x * 2 - 1;
  cameraSpace.y = mouse.percent.y * -2 + 1;

  raycaster.setFromCamera(cameraSpace, camera);
  updateIntersects();

  mouse.dispatchTypedEvent("mouseMove", new MouseMoveEvent());
});

globalThis.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  mouse.dispatchTypedEvent(
    "mouseButtonDown",
    new MouseButtonEvent(
      "down",
      event.button === 0 ? "left" : event.button === 1 ? "middle" : "right",
    ),
  );
});

globalThis.addEventListener("pointerup", (event) =>
  mouse.dispatchTypedEvent(
    "mouseButtonUp",
    new MouseButtonEvent(
      "up",
      event.button === 0 ? "left" : event.button === 1 ? "middle" : "right",
    ),
  ));

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
  update: (_, time) => (time - lastIntersectUpdate > 0.2) && updateIntersects(),
});
