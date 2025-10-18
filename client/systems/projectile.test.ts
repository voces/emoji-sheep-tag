import "../testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app } from "../ecs.ts";
import "./projectile.ts"; // Import to register the projectile system

describe("projectile tweening system", () => {
  it("should smoothly move projectile towards target", () => {
    // Create a projectile
    const projectile = app.addEntity({
      id: "projectile-1",
      position: { x: 0, y: 0 },
      projectile: {
        attackerId: "attacker-1",
        target: { x: 10, y: 0 },
        speed: 5,
        splashRadius: 1,
      },
      isDoodad: true,
    });

    // Update for 1 second
    app.update(1);

    // Should move 5 units towards target (speed * delta)
    expect(projectile.position?.x).toBeCloseTo(5, 5);
    expect(projectile.position?.y).toBeCloseTo(0, 5);
  });

  it("should not overshoot target", () => {
    // Create a projectile very close to target
    const projectile = app.addEntity({
      id: "projectile-3",
      position: { x: 9.9, y: 0 },
      projectile: {
        attackerId: "attacker-1",
        target: { x: 10, y: 0 },
        speed: 5,
        splashRadius: 1,
      },
      isDoodad: true,
    });

    // Update for 1 second (would move 5 units but only 0.1 away)
    app.update(1);

    // Should reach target but not overshoot
    expect(projectile.position?.x).toBeLessThanOrEqual(10);
    expect(projectile.position?.x).toBeGreaterThan(9.9);
  });

  it("should handle stationary projectile at target", () => {
    // Create a projectile already at target
    const projectile = app.addEntity({
      id: "projectile-4",
      position: { x: 10, y: 10 },
      projectile: {
        attackerId: "attacker-1",
        target: { x: 10, y: 10 },
        speed: 5,
        splashRadius: 1,
      },
      isDoodad: true,
    });

    const initialPosition = { ...projectile.position! };

    // Update
    app.update(0.5);

    // Position should not change
    expect(projectile.position?.x).toBe(initialPosition.x);
    expect(projectile.position?.y).toBe(initialPosition.y);
  });

  it("should handle multiple updates smoothly", () => {
    // Create a projectile
    const projectile = app.addEntity({
      id: "projectile-5",
      position: { x: 0, y: 0 },
      projectile: {
        attackerId: "attacker-1",
        target: { x: 10, y: 0 },
        speed: 2,
        splashRadius: 1,
      },
      isDoodad: true,
    });

    // Update multiple times
    app.update(1); // Move 2 units
    expect(projectile.position?.x).toBeCloseTo(2, 5);

    app.update(1); // Move another 2 units
    expect(projectile.position?.x).toBeCloseTo(4, 5);

    app.update(1); // Move another 2 units
    expect(projectile.position?.x).toBeCloseTo(6, 5);
  });
});
