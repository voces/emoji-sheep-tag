/**
 * Mood-vector modulation: applies continuous facet parameters as runtime
 * adjustments to the active bed without switching segments.
 *
 * Two knobs:
 *   - density  (driven by isolation): high isolation → mute counter/arp/pad,
 *                                     keep melody+bass. Solo-leaning texture.
 *   - color    (driven by agency): future hook for chord substitution. For
 *                                  now, maps to a velocity nudge — positive
 *                                  agency brightens (boost melody/counter),
 *                                  negative darkens (boost bass/perc).
 *
 * (Palette-bleed used to live here as a roundProgress-driven perc/drone
 * gain ramp. It moved to a per-layer `bleed` flag in segment authoring
 * — see BleedSpec in types.ts and computeBleedGain in renderer.ts. The
 * new mechanism is threat-driven, opt-in per layer, and per-bed
 * configurable via bleedSource and bleedFloor — strictly more capable
 * than the old time-based ramp it replaced.)
 *
 * Output is a MixState the renderer applies per layer per bar.
 */

import { type SheepFacets, type WolfFacets, type GameMode } from "./types.ts";

export interface MixState {
  /** Layer-id → gain multiplier (0-1+). Multiplied into the renderer's existing layer gain. */
  layerGains: Map<string, number>;
}

const ROLE_DENSITY_PRIORITY: Record<string, number> = {
  // Higher = drops sooner under high isolation. Foundation roles (bass/drone) never drop.
  arp: 3,
  pad: 2,
  counter: 1,
  perc: 0,
  drone: -1,
  bass: -1,
  melody: -1,
};

/** Compute modulation for a sheep facet vector. */
export function computeSheepMix(facets: SheepFacets): MixState {
  const gains = new Map<string, number>();

  // Density: isolation thins arp/pad/counter
  for (const role of Object.keys(ROLE_DENSITY_PRIORITY)) {
    const cutoff = roleCutoffByIsolation(role, facets.isolation);
    gains.set(role, cutoff);
  }

  // (Palette-bleed used to scale perc and drone by roundProgress here.
  // Replaced by the per-layer `bleed` flag in segment authoring; sheep
  // beds tag their timpani as `bleed bleedSource=tension`, which is
  // applied in the renderer's velocity calc.)

  // Agency: positive brightens (melody/counter +), negative darkens (bass/perc +)
  const agency = facets.agency;
  if (agency > 0) {
    gains.set("melody", (gains.get("melody") ?? 1) * (1 + 0.15 * agency));
    gains.set("counter", (gains.get("counter") ?? 1) * (1 + 0.10 * agency));
  } else if (agency < 0) {
    gains.set("bass", (gains.get("bass") ?? 1) * (1 + 0.15 * (-agency)));
    gains.set("perc", (gains.get("perc") ?? 1) * (1 + 0.20 * (-agency)));
  }

  return { layerGains: gains };
}

/** Compute modulation for a wolf facet vector.
 *  Wolf-side timpani is constant identity (never gets a bleed ramp) —
 *  it's the wolf's defining voice. Bulldog mode used to invert the perc
 *  palette-bleed polarity here; that mechanic moved to per-layer
 *  authoring on the build-wolf-bulldog bed if/when needed. */
export function computeWolfMix(facets: WolfFacets, _mode: GameMode = "survival"): MixState {
  const gains = new Map<string, number>();

  for (const role of Object.keys(ROLE_DENSITY_PRIORITY)) {
    const cutoff = roleCutoffByIsolation(role, facets.isolation);
    gains.set(role, cutoff);
  }

  // Agency: positive (winning) boosts melody/counter; negative quiets melody
  const agency = facets.agency;
  if (agency > 0) {
    gains.set("melody", (gains.get("melody") ?? 1) * (1 + 0.15 * agency));
  } else if (agency < 0) {
    gains.set("melody", (gains.get("melody") ?? 1) * (1 - 0.3 * (-agency)));
  }

  return { layerGains: gains };
}

/** Per-role gain reduction as isolation rises. */
function roleCutoffByIsolation(role: string, isolation: number): number {
  const priority = ROLE_DENSITY_PRIORITY[role] ?? 0;
  if (priority < 0) return 1; // foundation roles never drop
  // Each priority level ducks at a higher isolation threshold.
  // priority 1 starts ducking at iso 0.7
  // priority 2 starts ducking at iso 0.5
  // priority 3 starts ducking at iso 0.35
  const start = 1.05 - 0.25 * priority;
  if (isolation <= start) return 1;
  const span = Math.max(0.1, 1 - start);
  const t = Math.min(1, (isolation - start) / span);
  return Math.max(0.05, 1 - t);
}

/** Apply a MixState to the renderer's layer gains. Idempotent per call. */
export function applyMix(
  layerGainSetter: (layerId: string, gain: number) => void,
  layerIds: string[],
  mix: MixState,
): void {
  for (const id of layerIds) {
    const gain = mix.layerGains.get(id) ?? 1;
    layerGainSetter(id, gain);
  }
}
