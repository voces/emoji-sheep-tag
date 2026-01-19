import { addEntity } from "@/shared/api/entity.ts";
import { Entity } from "@/shared/types.ts";
import { appContext } from "@/shared/context.ts";

export const newFloatingText = (
  position: { x: number; y: number },
  text: string,
  { color, speed, duration = speed ? 2 + text.length / 10 : undefined, owner }:
    {
      color?: number;
      speed?: number;
      duration?: number;
      owner?: string;
    } = {},
) =>
  addEntity({
    isFloatingText: true,
    position,
    name: text,
    vertexColor: color,
    movementSpeed: speed,
    owner,
    ...(duration && Number.isFinite(duration) && {
      progress: 0,
      completionTime: duration,
      buffs: [{
        remainingDuration: duration,
        totalDuration: duration,
        expiration: "Floating Text",
      }],
    }),
  });

export const newGoldText = (
  position: { x: number; y: number },
  amount: number,
  owner?: string,
) =>
  newFloatingText(position, `+${amount.toFixed(0)}`, {
    color: 0xFFCC00,
    speed: 1.5,
    owner,
  });

// Debounced gold text helper that accumulates amounts per entity
const pendingGoldTexts = new Map<Entity, number>();
let isScheduled = false;

export const debouncedGoldText = (entity: Entity, amount: number) => {
  if (!entity.position) return;

  // Accumulate the amount for this entity
  const current = pendingGoldTexts.get(entity) ?? 0;
  pendingGoldTexts.set(entity, current + amount);

  // Schedule flush if not already scheduled
  if (!isScheduled) {
    isScheduled = true;
    appContext.current.enqueue(() => {
      // Create gold text for all pending entities
      for (const [e, total] of pendingGoldTexts.entries()) {
        if (e.position) {
          newGoldText(
            { x: e.position.x, y: e.position.y + 0.5 },
            total,
          );
        }
      }
      pendingGoldTexts.clear();
      isScheduled = false;
    });
  }
};
