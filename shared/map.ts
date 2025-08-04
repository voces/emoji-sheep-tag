import { Entity } from "./types.ts";

export const tiles = `
                           
                           
                           
                           
                           
                           
                           
                           
                           
                           
                           
           66666           
           66666           
           66666           
           66666           
           66666           
                           
                           
                           
                           
                           
                           
                           
                           
                           
                           
                           
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
    // { position: { x: 15.75, y: 12.25 } },
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
  shop: [
    { position: { x: 15.75, y: 12.25 } },
  ],
};
