import { Client } from "../client.ts";
import { Lobby } from "../lobby.ts";
import { smart } from "../util/smart.ts";

export const getIdealSheep = (players: number) =>
  Math.max(Math.floor((players - 1) / 2), 1);

export const getIdealTime = (players: number, sheep: number) => {
  const delta = sheep - (players - sheep) + 2; // deviation from the "n vs (n+2)" standard

  // 1) Baseline vs total players (smoothly saturating).
  //    Exactly fits: (1v3)=180, (2v4)=360, (3v5)=480 when delta = 0.
  const H = 720; // asymptotic baseline for delta=0
  const k = 0.2027325540540822;
  const T0 = 2.5809774172970905;
  const base = H * (1 - Math.exp(-k * (players - T0)));

  // 2) Synergy bias (team 1 is stronger).
  //    Boosts time when i > n-2, reduces when i < n-2.
  //    Calibrated so (5v5)=900 and (6v6)=1200.
  const alpha = -0.2545467458175773;
  const beta = 0.04917757356151352;
  const mult = Math.exp(delta * (alpha + beta * players));

  const raw = base * mult;

  // 3) Smooth floor & soft cap (no branches).
  //    Floor keeps tiny/negative outputs away; cap reins in huge lobbies.
  const floor = 120; // seconds (tweak to taste)
  const sFloor = 10; // smoothness; smaller = sharper clamp
  const floored = floor + sFloor * Math.log1p(Math.exp((raw - floor) / sFloor));

  const cap = 1200; // seconds (tweak or remove if you don't want a cap)
  const sCap = 5; // smaller ~ closer to min(floored, cap)
  const capped = -sCap *
    Math.log(Math.exp(-floored / sCap) + Math.exp(-cap / sCap)); // softmin

  return Math.round(capped / 30) * 30;
};

// Create a global smart drafter instance that persists across rounds
const smartDrafter = smart();

export const draftTeams = (lobby: Lobby, desiredSheep: number) => {
  const allPlayers = Array.from(lobby.players);
  const allPlayerIds = allPlayers.map((p) => p.id);

  // Use smart algorithm to select sheep
  const sheepIds = smartDrafter.draft(allPlayerIds, desiredSheep);

  // Convert IDs back to Client objects
  const sheep = new Set<Client>();
  const wolves = new Set<Client>();

  for (const player of allPlayers) {
    if (sheepIds.includes(player.id)) {
      sheep.add(player);
      player.sheepCount++;
    } else {
      wolves.add(player);
    }
  }

  return { sheep, wolves };
};

export const undoDraft = () => {
  smartDrafter.undo();
};

export const initializePlayer = (playerId: string, allPlayerIds?: string[]) => {
  smartDrafter.initializePlayer(playerId, allPlayerIds);
};
