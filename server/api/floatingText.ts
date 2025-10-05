import { addEntity } from "@/shared/api/entity.ts";

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
) => {
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
        expiration: "Floating Text",
      }],
    }),
  });
};

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
