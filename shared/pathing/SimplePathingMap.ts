class SimpleTile {
  basePathing: number;
  pathing: number;

  constructor(
    readonly xWorld: number,
    readonly yWorld: number,
    pathing: number,
  ) {
    this.basePathing = this.pathing = pathing;
  }
}

class SimplePathingMap {
  readonly resolution: number;
  readonly grid: SimpleTile[][];

  constructor(
    { resolution, pathing }: { resolution: number; pathing: number[][] },
  ) {
    this.resolution = resolution;

    this.grid = [];
    for (let y = 0; y < pathing.length; y++) {
      for (let x = 0; x < pathing[y].length; x++) {
        for (let y2 = 0; y2 < this.resolution; y2++) {
          const row = this.grid[y * this.resolution + y2] ||
            (this.grid[y * this.resolution + y2] = []);

          for (let x2 = 0; x2 < this.resolution; x2++) {
            row[x * this.resolution + x2] = new SimpleTile(
              x + x2 / this.resolution,
              y + y2 / this.resolution,
              pathing[y][x],
            );
          }
        }
      }
    }
  }
}
