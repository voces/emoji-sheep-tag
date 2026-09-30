import "global-jsdom/register";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import "./controls.ts";
import { app } from "./ecs.ts";
import { mouse, MouseButtonEvent, MouseMoveEvent } from "./mouse.ts";

// jsdom has no layout, so no hit-testing
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];

const pointer = (type: string, clientX = 0, clientY = 0) =>
  globalThis.dispatchEvent(
    Object.assign(new Event(type), { clientX, clientY, button: 0 }),
  );

const frame = () => app.update(1 / 60, performance.now() / 1000);

describe("mouse pipeline", () => {
  const log: string[] = [];
  const moves: MouseMoveEvent[] = [];
  const onMove = (e: MouseMoveEvent) => {
    log.push("move");
    moves.push(e);
  };
  const onDown = (_: MouseButtonEvent) => {
    log.push("down");
  };

  beforeEach(async () => {
    // Systems register on a microtask after the app module loads
    await Promise.resolve();
    frame();
    log.length = 0;
    moves.length = 0;
    mouse.addEventListener("mouseMove", onMove);
    mouse.addEventListener("mouseButtonDown", onDown);
  });

  afterEach(() => {
    mouse.removeEventListener("mouseMove", onMove);
    mouse.removeEventListener("mouseButtonDown", onDown);
  });

  it("coalesces pointer moves into one mouseMove per frame", () => {
    pointer("pointermove", 10, 20);
    pointer("pointermove", 30, 40);
    pointer("pointermove", 50, 60);
    expect(log).toEqual([]);
    expect(mouse.pixels.toArray()).toEqual([50, 60]);

    frame();
    expect(log).toEqual(["move"]);
    expect(moves[0].pixels.toArray()).toEqual([50, 60]);

    frame();
    expect(log).toEqual(["move"]);
  });

  it("flushes a pending move before a button event", () => {
    pointer("pointermove", 70, 80);
    pointer("pointerdown", 70, 80);
    expect(log).toEqual(["move", "down"]);

    frame();
    expect(log).toEqual(["move", "down"]);
  });

  it("hit-tests the DOM only when an event's element is read", () => {
    let calls = 0;
    document.elementFromPoint = () => {
      calls++;
      return document.body;
    };
    try {
      const event = new MouseMoveEvent();
      expect(calls).toBe(0);
      expect(event.element).toBe(document.body);
      expect(event.element).toBe(document.body);
      expect(calls).toBe(1);
    } finally {
      document.elementFromPoint = () => null;
    }
  });
});
