import { App } from "jsr:@verit/ecs";
import { Entity } from "./types.ts";
import { prand } from "./util/prand.ts";

export const tiles = `
                           
                           
                           
                           
                           
                           
                           
                           
                           
                           
          8888888          
          8666668          
          8666668          
          8666668          
          8666668          
          8666668          
          8888888          
                           
                           
                           
                           
                           
                           
                           
                           
                           
                           
`.slice(1, -1).split("\n").map((r) =>
  r.split("").map((v) => parseInt(v === " " ? "0" : v))
);

export const center = {
  x: tiles[0].length / 2,
  y: tiles.length / 2,
};

export const initEntities: Record<string, Partial<Entity>[]> = {
  fence: [
    { position: { x: 11.75, y: 11.25 } },
    { position: { x: 12.25, y: 11.25 } },
    { position: { x: 12.75, y: 11.25 } },
    { position: { x: 13.25, y: 11.25 } },

    { position: { x: 15.75, y: 11.25 } },
    { position: { x: 15.75, y: 11.75 } },
    { position: { x: 15.75, y: 12.25 } },
    { position: { x: 15.75, y: 12.75 } },
    { position: { x: 15.75, y: 13.25 } },

    { position: { x: 15.25, y: 15.75 } },
    { position: { x: 14.75, y: 15.75 } },
    { position: { x: 14.25, y: 15.75 } },
    { position: { x: 13.75, y: 15.75 } },

    { position: { x: 11.25, y: 15.25 } },
    { position: { x: 11.25, y: 14.75 } },
    { position: { x: 11.25, y: 14.25 } },
    { position: { x: 11.25, y: 13.75 } },
  ],
  tree: [
    { position: { x: 20, y: 20 } },
    { position: { x: 25.5, y: 0.5 } },
    { position: { x: 26.5, y: 0.5 } },
    { position: { x: 26.5, y: 1.5 } },
    { position: { x: 6.5, y: 6.5 } },
  ],
};

const floor = Math.floor;

const checkNearPathing = (
  x: number,
  y: number,
  near: number,
  pathing: number,
) => {
  if (tiles[floor(y)]?.[floor(x)] ?? 6 & pathing) return true;
  if (tiles[floor(y + near)]?.[floor(x)] ?? 6 & pathing) return true;
  if (tiles[floor(y - near)]?.[floor(x)] ?? 6 & pathing) return true;
  if (tiles[floor(y)]?.[floor(x + near)] ?? 6 & pathing) return true;
  if (tiles[floor(y + near)]?.[floor(x + near)] ?? 6 & pathing) return true;
  if (tiles[floor(y - near)]?.[floor(x + near)] ?? 6 & pathing) return true;
  if (tiles[floor(y)]?.[floor(x - near)] ?? 6 & pathing) return true;
  if (tiles[floor(y + near)]?.[floor(x - near)] ?? 6 & pathing) return true;
  if (tiles[floor(y - near)]?.[floor(x - near)] ?? 6 & pathing) return true;
  return false;
};

export const generateDoodads = (app: App<Entity>) => {
  const rng = prand(13784838577);
  for (let i = 0; i < tiles[0].length * tiles.length / 3; i++) {
    const x = rng() * tiles[0].length;
    const y = rng() * tiles.length;
    const r = Math.round(37 + (rng() - 0.5) * 30);
    const g = Math.round(102 + (rng() - 0.5) * 45);
    if (checkNearPathing(x, y, 0.25, 255)) continue;
    app.addEntity({
      id: `grass-${crypto.randomUUID()}`,
      prefab: "grass",
      position: { x, y },
      playerColor: `#${r.toString(16)}${g.toString(16)}00`,
      facing: Math.round(rng()) * Math.PI,
    });
  }
  for (let i = 0; i < tiles[0].length * tiles.length / 20; i++) {
    const x = rng() * tiles[0].length;
    const y = rng() * tiles.length;
    if (checkNearPathing(x, y, 0.25, 255)) continue;
    const r = rng();
    const g = rng();
    const b = rng();
    const scale = Math.min(1 / r, 1 / g, 1 / b) * 255;
    app.addEntity({
      id: `flowers-${crypto.randomUUID()}`,
      prefab: "flowers",
      position: { x, y },
      playerColor: `#${Math.floor(r * scale).toString(16).padStart(2, "0")}${
        Math.floor(g * scale).toString(16).padStart(2, "0")
      }${Math.floor(b * scale).toString(16).padStart(2, "0")}`,
      facing: Math.round(rng()) * Math.PI,
    });
  }
};
