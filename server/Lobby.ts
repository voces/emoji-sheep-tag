const spawns = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

class Player {
  slot: number;

  constructor(readonly id: string, slot: number) {
    this.slot = slot;
  }

  get spawn() {
    return spawns[this.slot];
  }
}

// class Thread {
//     contexts: Context<unknown>[] = [];

//     registerContext(context: Context<unknown>) {
//         this.contexts.push(context);
//     }

//     with<R>(contexts: Context<unknown>[], fn: () => R) {
//         const oldContexts = this.contexts;
//         this.contexts = contexts;
//         try {
//             return fn();
//         } finally {
//             this.contexts = oldContexts;
//         }
//     }

//     timeout(fn: () => void, timeout: number) {
//         const current =
//     }
// }

class Context<T> {
  current: T;

  constructor(initial: T) {
    this.current = initial;
  }

  with<R>(value: T, fn: () => R) {
    const oldCurrent = this.current;
    this.current = value;
    try {
      return fn();
    } finally {
      this.current = oldCurrent;
    }
  }
}

type UnitKind = "sheep";

class Unit {
  owner: Player;
  x: number;
  y: number;

  constructor(
    readonly kind: UnitKind,
    owner: Player,
    x: number,
    y: number,
  ) {
    this.owner = owner;
    this.x = x;
    this.y = y;
  }
}

class World {
  units: Unit[] = [];

  createUnit(kind: UnitKind, owner: Player, x: number, y: number) {
    this.units.push(new Unit(kind, owner, x, y));
  }
}

type RoundConfig = {
  sheep: Player[];
  wolves: Player[];
};

class Round {
  constructor(config: RoundConfig) {
    this.world = new World();
    this.sheep = config.sheep;
    this.wolves = config.wolves;

    this.spawnTimeout = setTimeout(() => {
      this.spawnSheep();
    }, 3_000);
  }

  cancel() {
    clearTimeout(this.spawnTimeout);
  }

  private readonly sheep: Player[];
  private readonly wolves: Player[];
  private spawnTimeout: number | undefined;
  private readonly world: World;

  private spawnSheep() {
    for (const sheep of this.sheep) {
      this.world.createUnit("sheep", sheep, sheep.spawn.x, sheep.spawn.y);
    }
  }
}

export class Lobby {
  players = new Set<Player>();
  round: Round | undefined;

  startRound() {
    if (this.players.size < 2) {
      throw new Error("Expected there to be at least two players");
    }
    const sheep: Player[] = [];
    const wolves: Player[] = [];
    let addToSheep = true;
    for (const player of this.players) {
      (addToSheep ? sheep : wolves).push(player);
      addToSheep = !addToSheep;
    }

    this.round = new Round({ sheep, wolves });
  }
}
