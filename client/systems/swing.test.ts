import "../testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app } from "../ecs.ts";
import { newUnit } from "../../server/api/unit.ts";
import "./swing.ts"; // Import to register the swing system
import "./action.ts"; // Import to register the action system

describe("swing system", () => {
  it("should remove swing visual when swing property is removed", () => {
    // Create an attacking unit with a swing
    const attacker = newUnit("player-1", "wolf", 5, 5);
    const target = newUnit("player-2", "sheep", 6, 5);

    attacker.order = { type: "attack", targetId: target.id };
    attacker.swing = {
      remaining: 0.5,
      source: { x: 5, y: 5 },
      target: { x: 6, y: 5 },
    };

    // Give the system time to create the swing visual
    app.update(0);

    // Verify swing visual was created
    const swingVisuals = Array.from(app.entities).filter((e) =>
      e.prefab === "claw"
    );
    expect(swingVisuals.length).toBe(1);

    // Server removes swing property (simulated)
    delete attacker.swing;

    // Update to trigger the onRemove handler
    app.update(0);

    // Verify swing visual was also removed
    const remainingSwingVisuals = Array.from(app.entities).filter((e) =>
      e.prefab === "claw"
    );
    expect(remainingSwingVisuals.length).toBe(0);
  });

  it("should update swing visual when swing property changes", () => {
    // Create an attacking unit with a swing
    const attacker = newUnit("player-1", "wolf", 5, 5);
    const target = newUnit("player-2", "sheep", 6, 5);

    attacker.order = { type: "attack", targetId: target.id };
    attacker.swing = {
      remaining: 0.5,
      source: { x: 5, y: 5 },
      target: { x: 6, y: 5 },
    };

    // Give the system time to create the swing visual
    app.update(0);

    // Verify swing visual was created
    const swingVisuals = Array.from(app.entities).filter((e) =>
      e.prefab === "claw"
    );
    expect(swingVisuals.length).toBe(1);
    const firstSwing = swingVisuals[0];

    // Update swing to a new target (server updates position)
    attacker.swing = {
      remaining: 0.3,
      source: { x: 5, y: 5 },
      target: { x: 7, y: 5 },
    };

    // Update to trigger the onChange handler
    app.update(0);

    // Verify old swing visual was removed and new one created
    const updatedSwingVisuals = Array.from(app.entities).filter((e) =>
      e.prefab === "claw"
    );
    expect(updatedSwingVisuals.length).toBe(1);
    expect(updatedSwingVisuals[0]).not.toBe(firstSwing);
  });

  it("should create swing visual when swing property is added", () => {
    // Create an attacking unit
    const attacker = newUnit("player-1", "wolf", 5, 5);
    const target = newUnit("player-2", "sheep", 6, 5);

    attacker.order = { type: "attack", targetId: target.id };

    // No swing visual yet
    app.update(0);
    const initialVisuals = Array.from(app.entities).filter((e) =>
      e.prefab === "claw"
    );
    expect(initialVisuals.length).toBe(0);

    // Server adds swing property
    attacker.swing = {
      remaining: 0.5,
      source: { x: 5, y: 5 },
      target: { x: 6, y: 5 },
    };

    // Update to trigger the onAdd handler
    app.update(0);

    // Swing visual should now exist
    const swingVisuals = Array.from(app.entities).filter((e) =>
      e.prefab === "claw"
    );
    expect(swingVisuals.length).toBe(1);
  });
});
