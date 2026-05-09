/**
 * estune v3 adaptive music — game-side wiring.
 *
 * Responsibilities (boundary between game and engine):
 *   - Lazy-create AudioContext on first user gesture (browser autoplay policy).
 *   - Lazy-load SF2 + bed library on first round-start (bandwidth).
 *   - Per-tick: compute SheepFacets / WolfFacets from the ECS, call setGameState.
 *   - Watch ECS for capture/rescue (sheep ↔ spirit prefab transitions per owner)
 *     and fire the matching GameEvent.
 *   - Mirror the lobby/build/active structural state from stateVar + lobby timing.
 *
 * The engine itself is treated as opaque; we only touch its public surface
 * (setGameState / fireGameEvent / setRoundHook + lifecycle).
 */

import { addSystem } from "@/shared/context.ts";
import { type Entity } from "../ecs.ts";
import { stateVar } from "@/vars/state.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { practiceVar } from "@/vars/practice.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { getLocalPlayer } from "../api/player.ts";
import { isStructure } from "@/shared/api/unit.ts";
import { isNight } from "@/shared/dayNight.ts";
import {
  fireGameEvent,
  type FullGameState,
  setGameState,
  type SheepFacets,
  startEngine,
  startRecording,
  stopRecording,
  type StructuralState,
  type WolfFacets,
} from "../estune/index.ts";
import type { V3EngineState } from "../estune/engine.ts";
import { channels, listener } from "../graphics/three.ts";
import {
  computeSheepAgencyValue,
  computeWolfAgencyValue,
  createAgencyEvents,
  recordKill,
  recordProximity,
  recordRescue,
  resetAgencyEvents,
} from "./agency.ts";

const TICK_HZ = 15;
const TICK_INTERVAL = 1 / TICK_HZ;

// Asymmetric: the wolf's awareness of sheep extends further than the sheep's
// awareness of wolves. Larger wolf radius means proximity ramps in earlier
// during pursuit, so the engine is less likely to oscillate across bed-
// selection thresholds as the wolf closes the gap.
const SHEEP_DANGER_RADIUS = 12;
const WOLF_DANGER_RADIUS = 18;
const PACK_RADIUS = 24;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

let engine: V3EngineState | null = null;
let started = false;
let pendingStart: Promise<void> | null = null;
let prevSheep: SheepFacets | null = null;
let prevWolf: WolfFacets | null = null;
let lastTickElapsed = 0;
let roundStartMs = 0;

type OwnedPrefab = "sheep" | "spirit" | "wolf" | null;
const ownerPrefab = new Map<string, OwnedPrefab>();

const agencyEvents = createAgencyEvents();
const structuresByOwner = new Map<string, Set<Entity>>();

const removeStructure = (e: Entity): void => {
  for (const [owner, set] of structuresByOwner) {
    if (set.delete(e) && set.size === 0) structuresByOwner.delete(owner);
  }
};

const addStructure = (e: Entity): void => {
  if (!e.owner || !isStructure(e)) return;
  let set = structuresByOwner.get(e.owner);
  if (!set) {
    set = new Set();
    structuresByOwner.set(e.owner, set);
  }
  set.add(e);
};

const teamStructureCount = (): number => {
  const seen = new Set<string>();
  for (const e of liveUnits.sheep) if (e.owner) seen.add(e.owner);
  for (const e of liveUnits.spirits) if (e.owner) seen.add(e.owner);
  let total = 0;
  for (const owner of seen) total += structuresByOwner.get(owner)?.size ?? 0;
  return total;
};

/** Spin up the AudioContext + SF2 + bed library + stingers. Idempotent.
 *  Only starts if the host's AudioListener is available — without it the
 *  engine would create its own AudioContext and bypass our master/music
 *  bus chain entirely, which would silence the volume sliders. */
const ensureStarted = (): Promise<void> => {
  if (started) return Promise.resolve();
  if (pendingStart) return pendingStart;
  if (!listener) return Promise.resolve();
  pendingStart = startEngine({
    audioContext: listener.context,
    outputBus: channels.music,
  })
    .then((e) => {
      engine = e;
      started = true;
    })
    .catch((err) => {
      console.error("[v3] startEngine failed:", err);
      pendingStart = null;
      throw err;
    });
  return pendingStart;
};

const distanceSq = (a: Entity, b: Entity): number => {
  if (!a.position || !b.position) return Number.POSITIVE_INFINITY;
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return dx * dx + dy * dy;
};

/** Soft-min aggregation: closer entities weighted more, never spikes.
 *  Uses edge-to-edge distance (center − radii) so touching units hit ~1.0
 *  instead of capping near 0.91 from sheep+wolf radii ≈ 0.75 separation. */
const softProximity = (
  selfEntity: Entity,
  others: Iterable<Entity>,
  radius: number,
): number => {
  if (!selfEntity.position) return 0;
  const selfR = selfEntity.radius ?? 0;
  let sum = 0;
  for (const o of others) {
    if (o === selfEntity || !o.position) continue;
    const center = Math.sqrt(distanceSq(selfEntity, o));
    const edge = center - selfR - (o.radius ?? 0);
    sum += radius / Math.max(0.1, edge);
  }
  return sum / (1 + sum);
};

const nearestOtherDistance = (
  selfEntity: Entity,
  others: Iterable<Entity>,
): number => {
  let best = Number.POSITIVE_INFINITY;
  for (const o of others) {
    if (o === selfEntity) continue;
    const d2 = distanceSq(selfEntity, o);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
};

type LiveUnits = {
  sheep: Set<Entity>;
  spirits: Set<Entity>;
  wolves: Set<Entity>;
};

const liveUnits: LiveUnits = {
  sheep: new Set(),
  spirits: new Set(),
  wolves: new Set(),
};

const setForPrefab = (prefab: string | undefined): Set<Entity> | null =>
  prefab === "sheep"
    ? liveUnits.sheep
    : prefab === "spirit"
    ? liveUnits.spirits
    : prefab === "wolf"
    ? liveUnits.wolves
    : null;

const findLocalUnit = (localId: string) => {
  for (const e of liveUnits.sheep) {
    if (e.owner === localId) return { unit: e, kind: "sheep" as const };
  }
  for (const e of liveUnits.spirits) {
    if (e.owner === localId) return { unit: e, kind: "spirit" as const };
  }
  for (const e of liveUnits.wolves) {
    if (e.owner === localId) return { unit: e, kind: "wolf" as const };
  }
  return null;
};

type FacetContext = {
  totalSheep: number;
  roundProgress: number;
  elapsedSeconds: number;
  now: number;
};

const computeSheepFacets = (
  unit: Entity,
  alive: boolean,
  ctx: FacetContext,
): SheepFacets => {
  const livingSheep = liveUnits.sheep.size;
  const threat = softProximity(unit, liveUnits.wolves, SHEEP_DANGER_RADIUS);
  // 1v1 / last-sheep: no peers to measure distance from. The engine's
  // density modulator thins arp/pad/counter at higher isolation; a flat
  // 0.4 starts thinning (arp gates at 0.35) without bottoming out the bed.
  const isolation = liveUnits.sheep.size <= 1
    ? 0.4
    : clamp01(nearestOtherDistance(unit, liveUnits.sheep) / 50);
  if (unit.owner) {
    recordProximity(agencyEvents, unit.owner, threat, ctx.now);
  }
  const unitStructures = unit.owner
    ? structuresByOwner.get(unit.owner)?.size ?? 0
    : 0;
  const agency = unit.owner
    ? computeSheepAgencyValue(agencyEvents, {
      unitId: unit.owner,
      livingSheep,
      totalSheep: ctx.totalSheep,
      roundProgress: ctx.roundProgress,
      elapsedSeconds: ctx.elapsedSeconds,
      unitStructures,
      teamStructures: teamStructureCount(),
      now: ctx.now,
    })
    : 0;
  return {
    alive,
    threat,
    agency,
    isolation,
    lastAlive: alive && livingSheep === 1,
  };
};

const computeWolfFacets = (
  unit: Entity,
  ctx: FacetContext,
): WolfFacets => {
  const livingSheep = liveUnits.sheep.size;
  const proximity = softProximity(unit, liveUnits.sheep, WOLF_DANGER_RADIUS);
  // Lone wolf: same rationale as sheep — engage the engine's solo texture
  // path rather than reading as a packed lobby bed.
  const isolation = liveUnits.wolves.size <= 1
    ? 0.4
    : clamp01(nearestOtherDistance(unit, liveUnits.wolves) / PACK_RADIUS);
  if (unit.owner) {
    recordProximity(agencyEvents, unit.owner, proximity, ctx.now);
  }
  const agency = unit.owner
    ? computeWolfAgencyValue(agencyEvents, {
      unitId: unit.owner,
      livingSheep,
      totalSheep: ctx.totalSheep,
      roundProgress: ctx.roundProgress,
      elapsedSeconds: ctx.elapsedSeconds,
      teamStructures: teamStructureCount(),
      now: ctx.now,
    })
    : 0;
  return {
    proximity,
    agency,
    isolation,
  };
};

const getStructuralState = (): StructuralState => {
  const s = stateVar();
  if (s !== "playing") return "lobby";
  // Practice stays in lobby for the entire round — there's no real
  // build/active arc, so the lobby bed plays through.
  if (practiceVar()) return "lobby";
  return liveUnits.wolves.size > 0 ? "active" : "build";
};

/** Round duration for the engine's urgency / endgame derivations. Vamp has
 *  no time-based win condition (round ends when all sheep are converted),
 *  so we report null and the engine skips endgame routing. */
const getRoundDurationSeconds = (): number | null => {
  const settings = lobbySettingsVar();
  if (settings.mode === "vamp") return null;
  const t = settings.time;
  return typeof t === "number" && t > 0 ? t : null;
};

/** Roundprogress fallback for agency math. Falls back to 120s when the
 *  game gives us no duration (vamp / unset) so urgency-style weighting in
 *  agency.ts still has a sensible denominator. */
const getRoundProgressDenominator = (): number => {
  const d = getRoundDurationSeconds();
  return d ?? 120;
};

// Mirror the visual day/night cycle (shared/dayNight.ts) into the engine's
// daylight/darkness bleed sources so layers tagged with those gates fade
// in lockstep with the world. Lobby has no timer entry → forced to day.
const computeDaylight = (structuralState: StructuralState): number =>
  structuralState === "lobby" ? 1 : isNight() ? 0 : 1;

const driveTick = () => {
  if (!started || !engine) return;

  // Round clock starts at wolf spawn, matching the server's `round.start`
  // (set in gameStartHelpers.ts:518/538 alongside `spawnWolves`). Build
  // phase reports roundProgress: 0; the timer only ticks once the round
  // is actually contested.
  if (roundStartMs === 0 && liveUnits.wolves.size > 0) {
    roundStartMs = performance.now();
  }

  const localPlayer = getLocalPlayer();
  const localId = localPlayer?.id ?? localPlayerIdVar();
  const elapsed = roundStartMs === 0
    ? 0
    : (performance.now() - roundStartMs) / 1000;
  const roundDuration = getRoundDurationSeconds();
  const roundProgress = clamp01(elapsed / getRoundProgressDenominator());
  const totalSheep = liveUnits.sheep.size + liveUnits.spirits.size;
  const structuralState = getStructuralState();

  // Perspective comes from the player's team, not their current unit prefab.
  // During build phase the wolf player has no wolf entity yet — we'd
  // otherwise misreport "spirit" until t=21s.
  let perspective: FullGameState["perspective"] = "spirit";
  if (localPlayer?.team === "wolf") perspective = "wolf";
  else if (localPlayer?.team === "sheep") {
    const local = localId ? findLocalUnit(localId) : null;
    perspective = local?.kind === "spirit" ? "spirit" : "sheep";
  }

  const ctx: FacetContext = {
    totalSheep,
    roundProgress,
    elapsedSeconds: elapsed,
    now: performance.now(),
  };

  let sheep: SheepFacets | undefined;
  let wolf: WolfFacets | undefined;
  const local = localId ? findLocalUnit(localId) : null;
  if (perspective === "wolf" && local?.kind === "wolf") {
    wolf = computeWolfFacets(local.unit, ctx);
    prevWolf = wolf;
    prevSheep = null;
  } else if (perspective === "sheep" && local?.kind === "sheep") {
    sheep = computeSheepFacets(local.unit, true, ctx);
    prevSheep = sheep;
    prevWolf = null;
  } else if (perspective === "spirit" && local?.kind === "spirit") {
    sheep = computeSheepFacets(local.unit, false, ctx);
    prevSheep = sheep;
    prevWolf = null;
  } else if (structuralState !== "lobby" && prevSheep) sheep = prevSheep;
  else if (structuralState !== "lobby" && prevWolf) wolf = prevWolf;

  const state: FullGameState = {
    state: structuralState,
    perspective,
    sheep,
    wolf,
    roundHook: null,
    mode: lobbySettingsVar().mode,
    daylight: computeDaylight(structuralState),
    // Engine derives urgency, roundFinal, and roundCountdown from these
    // (see types.ts:420). Lobby leaves them undefined so the engine's
    // endgame routing stays dormant outside playing rounds.
    roundElapsedSeconds: structuralState === "lobby" ? undefined : elapsed,
    roundDurationSeconds: structuralState === "lobby"
      ? undefined
      : roundDuration,
  };
  setGameState(engine, state);
};

/** Resolve the owner ID of the wolf that killed `victimOwner`'s sheep, by
 *  reading `lastAttacker` off the dying sheep entity (still in liveUnits at
 *  this point — server flushes the new spirit before removing the sheep).
 *  Returns undefined if we can't resolve, in which case the agency calc
 *  falls back to a uniform spike. */
const findKillerOwner = (victimOwner: string): string | undefined => {
  for (const sheep of liveUnits.sheep) {
    if (sheep.owner !== victimOwner) continue;
    if (!sheep.lastAttacker) return undefined;
    for (const wolf of liveUnits.wolves) {
      if (wolf.id === sheep.lastAttacker) return wolf.owner ?? undefined;
    }
    return undefined;
  }
  return undefined;
};

const syncOwnerTransition = (e: Entity) => {
  if (!e.owner) return;
  const t = e.prefab as OwnedPrefab;
  if (t !== "sheep" && t !== "spirit" && t !== "wolf") return;
  const prev = ownerPrefab.get(e.owner);
  if (prev === t) return;
  ownerPrefab.set(e.owner, t);
  if (!started || !engine) return;
  // Practice has no real captures/rescues — sheep↔spirit transitions are
  // just respawn cycles, not narrative beats.
  if (practiceVar()) return;
  const subject: "self" | "ally" = e.owner === localPlayerIdVar()
    ? "self"
    : "ally";
  if (prev === "sheep" && t === "spirit") {
    fireGameEvent(engine, { type: "capture", subject });
    recordKill(
      agencyEvents,
      e.owner,
      performance.now(),
      findKillerOwner(e.owner),
    );
  } else if (prev === "spirit" && t === "sheep") {
    fireGameEvent(engine, { type: "rescue", subject });
    recordRescue(agencyEvents, e.owner, performance.now());
  }
};

const reclassify = (e: Entity) => {
  liveUnits.sheep.delete(e);
  liveUnits.spirits.delete(e);
  liveUnits.wolves.delete(e);
  removeStructure(e);
  const unitSet = setForPrefab(e.prefab);
  if (unitSet) unitSet.add(e);
  else if (isStructure(e)) addStructure(e);
};

// Single system: maintains prefab-keyed live-unit sets + structure ownership,
// detects owner-level sheep↔spirit transitions, and drives setGameState at
// TICK_HZ.
addSystem<Entity, "prefab" | "owner">({
  props: ["prefab", "owner"],
  onAdd: (e) => {
    reclassify(e);
    syncOwnerTransition(e);
  },
  onChange: (e) => {
    reclassify(e);
    syncOwnerTransition(e);
  },
  onRemove: (e) => {
    liveUnits.sheep.delete(e);
    liveUnits.spirits.delete(e);
    liveUnits.wolves.delete(e);
    removeStructure(e);
    if (e.owner && ownerPrefab.get(e.owner) === e.prefab) {
      ownerPrefab.delete(e.owner);
    }
  },
  update: (delta: number) => {
    lastTickElapsed += delta;
    if (lastTickElapsed < TICK_INTERVAL) return;
    lastTickElapsed = 0;
    driveTick();
  },
});

// Round lifecycle: re-arm on round-start, fire round-end stinger on round-end.
// startEngine() installs the bed library once; it persists across rounds.
let prevState = stateVar();
stateVar.subscribe((next) => {
  if (next === "playing" && prevState !== "playing") {
    // Reset; driveTick sets it when sheep first spawn (post-countdown).
    roundStartMs = 0;
    ownerPrefab.clear();
    resetAgencyEvents(agencyEvents);
  } else if (prevState === "playing" && next !== "playing") {
    // Capture winner now while liveUnits is still populated; the actual
    // fire happens when roundsVar grows so we don't fire on cancellations.
    pendingWinner = !practiceVar() && (engine && started)
      ? (liveUnits.sheep.size > 0 ? "sheep" : "wolf")
      : null;
    prevSheep = null;
    prevWolf = null;
  }
  prevState = next;
});

// roundsVar only grows when the server's stop message includes a completed
// Round (i.e. a real outcome). Cancellations don't push, so the round-end
// stinger only fires for legitimate wins/losses.
let pendingWinner: "sheep" | "wolf" | null = null;
let prevRoundsLength = roundsVar().length;
roundsVar.subscribe((rounds) => {
  if (rounds.length > prevRoundsLength && pendingWinner && engine) {
    fireGameEvent(engine, { type: "round-end", winner: pendingWinner });
  }
  prevRoundsLength = rounds.length;
  pendingWinner = null;
});

// First-gesture handler kicks off the AudioContext + SF2 load. Must run
// synchronously inside the gesture for browser autoplay policies.
const startOnGesture = () => {
  ensureStarted().catch(() => {});
  document.removeEventListener("pointerdown", startOnGesture);
  document.removeEventListener("keydown", startOnGesture);
};
document.addEventListener("pointerdown", startOnGesture);
document.addEventListener("keydown", startOnGesture);

// Debug recorder. Use from the devtools console:
//   estuneRecord()    // begin capturing facets/notes/events
//   estuneDownload()  // stop and download estune-rec-<ts>.json for analysis
// Send the JSON to estune for diagnosing bed/mix transition glitches.
declare global {
  var estuneRecord: () => void;
  var estuneDownload: () => void;
}
globalThis.estuneRecord = () => {
  if (!engine) {
    console.warn("[v3] estuneRecord: engine not started yet");
    return;
  }
  startRecording(engine);
  console.log("[v3] recording started");
};
globalThis.estuneDownload = () => {
  if (!engine) {
    console.warn("[v3] estuneDownload: engine not started");
    return;
  }
  const rec = stopRecording(engine);
  if (!rec) {
    console.warn("[v3] estuneDownload: no active recording");
    return;
  }
  const blob = new Blob([JSON.stringify(rec, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estune-rec-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log(
    `[v3] recording stopped (${(rec.durationMs / 1000).toFixed(1)}s)`,
  );
};
