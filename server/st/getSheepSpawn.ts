import { getMapCenter } from "@/shared/map.ts";

export const getSheepSpawn = (): [x: number, y: number] => {
  const center = getMapCenter();
  if (Math.random() < 0.5) {
    const x = Math.random() * 9 - 4.5;
    const y = Math.random() < 0.5 ? 5 : -5;
    return [center.x + x, center.y + y];
  }

  const x = Math.random() < 0.5 ? 4.5 : -4.5;
  const y = Math.random() * 10 - 5;
  return [center.x + x, center.y + y];
};

export const getSpiritSpawn = (): [
  x: number,
  y: number,
] => {
  const center = getMapCenter();
  return [
    center.x + (Math.random() * 5 - 2.5),
    center.y + (Math.random() * 6 - 3),
  ];
};
