import { DEFAULT_FACING, MIRROR_SEPARATION } from "../../shared/constants.ts";
import { currentApp } from "../contexts.ts";
import { onInit, UnitDeathEvent } from "../ecs.ts";
import { lookup } from "../systems/lookup.ts";

onInit((game) => {
  game.addEventListener("unitOrder", (e) => {
    const u = e.unit;
    if (e.order !== "mirrorImage" || !u.position || u.isMirror) return;

    if (u.mirrors) {
      for (const mirrorId of u.mirrors) {
        const mirror = lookup(mirrorId);
        if (mirror) {
          currentApp().dispatchTypedEvent(
            "unitDeath",
            new UnitDeathEvent(mirror, undefined),
          );
        }
      }
      delete u.mirrors;
    }

    const angle1 = (u.facing ?? DEFAULT_FACING) + Math.PI / 2;
    const angle2 = (u.facing ?? DEFAULT_FACING) - Math.PI / 2;
    let pos1 = {
      x: u.position.x + Math.cos(angle1) * MIRROR_SEPARATION,
      y: u.position.y + Math.sin(angle1) * MIRROR_SEPARATION,
    };
    let pos2 = {
      x: u.position.x + Math.cos(angle2) * MIRROR_SEPARATION,
      y: u.position.y + Math.sin(angle2) * MIRROR_SEPARATION,
    };

    if (Math.random() < 0.5) [pos1, pos2] = [pos2, pos1];

    u.action = {
      type: "cast",
      remaining: 0.5,
      info: { type: "mirrorImage", positions: [pos1, pos2] },
    };
    delete u.queue;
  });
});
