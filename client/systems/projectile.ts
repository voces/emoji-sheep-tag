import { app } from "../ecs.ts";
import { distanceBetweenPoints } from "@/shared/pathing/math.ts";

app.addSystem({
  props: ["projectile", "position"],
  updateEntity: (e, delta) => {
    if (!e.projectile || !e.position) return;

    const distance = distanceBetweenPoints(e.position, e.projectile.target);

    // If we've reached the target, don't tween (let server handle removal)
    if (distance < 0.01) return;

    const movement = e.projectile.speed * delta;

    // Calculate direction and new position
    const dx = e.projectile.target.x - e.position.x;
    const dy = e.projectile.target.y - e.position.y;
    const ratio = Math.min(movement / distance, 1);

    // Smoothly interpolate position
    e.position = {
      x: e.position.x + dx * ratio,
      y: e.position.y + dy * ratio,
    };

    // Tumble effect
    if (e.projectile.tumble) {
      e.facing = (e.facing ?? 0) + e.projectile.tumble * delta;
    }
  },
});
