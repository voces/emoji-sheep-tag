import { Grid } from "./Grid.ts";
import { prefabs } from "@/shared/data.ts";
import { Entity } from "../ecs.ts";
import { pathingMap } from "../systems/pathing.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { Group } from "three";

export class BuildGrid extends Group {
  private grid: Grid | undefined;
  private currentWidth = 0;
  private currentHeight = 0;
  private lastUpdate = 0;

  constructor() {
    super();
    this.visible = false;
  }

  private validateGrid(
    x: number,
    y: number,
    width: number,
    height: number,
    left: number,
    top: number,
    map: readonly number[],
  ) {
    // Fast path: directly check terrain tiles without entity manipulation
    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const worldX = x + left / 4 + cx / 4;
        const worldY = y + top / 4 + cy / 4;
        const pathing = map[cy * width + cx];

        const cellPathable = pathingMap.terrainPathablePoint(
          worldX,
          worldY,
          pathing,
        );

        if (cellPathable) {
          this.grid!.setColor(cx, height - cy - 1, 0, 1, 0, 0.3);
        } else {
          this.grid!.setColor(cx, height - cy - 1, 1, 0, 0, 0.3);
        }
      }
    }
  }

  updateForBlueprint(
    builder: Entity,
    unitType: string,
    x: number,
    y: number,
  ) {
    const prefab = prefabs[unitType];
    if (
      !(prefab.requiresTilemap ?? prefab?.tilemap) || !isPathingEntity(builder)
    ) {
      this.visible = false;
      return;
    }

    const { width, height, left, top, map } = prefab.requiresTilemap ??
      prefab.tilemap!;

    const now = Date.now();

    if (
      this.position.x === x && this.position.y === y && this.grid &&
      this.currentWidth === width && this.currentHeight === height &&
      this.visible && this.lastUpdate + 200 >= now
    ) return;

    this.lastUpdate = now;

    // Create or recreate grid if size changed
    if (
      !this.grid || this.currentWidth !== width || this.currentHeight !== height
    ) {
      if (this.grid) {
        this.remove(this.grid);
        this.grid.geometry.dispose();
      }
      this.grid = new Grid(width, height);
      if ("depthWrite" in this.grid.material) {
        this.grid.material.depthWrite = false;
      }
      this.grid.position.z = -0.001; // Slightly above terrain but below everything else
      this.grid.scale.setScalar(0.25);
      this.add(this.grid);
      this.currentWidth = width;
      this.currentHeight = height;
    }

    this.position.x = x;
    this.position.y = y;

    // Fast terrain-only checks - no debouncing needed
    this.validateGrid(x, y, width, height, left, top, map);

    this.visible = true;
  }

  hide() {
    this.visible = false;
  }
}
