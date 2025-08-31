import { center } from "@/shared/map.ts";

export const getSheepSpawn = (): [x: number, y: number] => {
  if (Math.random() < 0.5) {
    const x = Math.random() * 6 - 3;
    const y = Math.random() < 0.5 ? 3 : -3;
    return [center.x + x, center.y + y];
  }

  const x = Math.random() < 0.5 ? 3 : -3;
  const y = Math.random() * 6 - 3;
  return [center.x + x, center.y + y];
};

export const getSpiritSpawn = (): [
  x: number,
  y: number,
] => [
  center.x + (Math.random() * 3.5 - 1.75),
  center.y + (Math.random() * 3.5 - 1.75),
];
