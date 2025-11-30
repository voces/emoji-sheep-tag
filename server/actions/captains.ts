import { z } from "zod";
import { Client } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { lobbyContext } from "../contexts.ts";
import type { CaptainsDraft, Lobby } from "../lobby.ts";
import { serializeLobbySettings } from "./lobbySettings.ts";

export const zStartCaptains = z.object({
  type: z.literal("startCaptains"),
});

export const zSelectCaptain = z.object({
  type: z.literal("selectCaptain"),
  playerId: z.string(),
});

export const zRandomCaptains = z.object({
  type: z.literal("randomCaptains"),
});

export const zCaptainPick = z.object({
  type: z.literal("captainPick"),
  playerId: z.string(),
});

export const zCancelCaptains = z.object({
  type: z.literal("cancelCaptains"),
});

const getNonObserverPlayers = (lobby: Lobby) =>
  Array.from(lobby.players).filter(
    (p) => p.team !== "observer" && p.team !== "pending",
  );

const broadcastCaptainsState = () => {
  const lobby = lobbyContext.current;
  const draft = serializeCaptainsDraft(lobby.captainsDraft);
  if (draft) {
    send({ type: "captainsDraft", ...draft });
  } else {
    send({ type: "captainsDraft", phase: undefined });
  }
};

export const serializeCaptainsDraft = (draft: CaptainsDraft | undefined) =>
  draft
    ? {
      phase: draft.phase,
      captains: draft.captains,
      picks: draft.picks,
      currentPicker: draft.currentPicker,
      picksThisTurn: draft.picksThisTurn,
    }
    : null;

export const startCaptains = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) return;
  if (lobby.status !== "lobby") return;
  if (lobby.captainsDraft) return;

  const nonObservers = getNonObserverPlayers(lobby);
  if (nonObservers.length < 3) return;

  lobby.captainsDraft = {
    phase: "selecting-captains",
    captains: [],
    picks: [[], []],
    currentPicker: 0,
    picksThisTurn: 1,
  };

  broadcastCaptainsState();
};

export const selectCaptain = (
  client: Client,
  { playerId }: z.TypeOf<typeof zSelectCaptain>,
) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) return;
  if (lobby.captainsDraft?.phase !== "selecting-captains") return;

  const nonObservers = getNonObserverPlayers(lobby);
  const player = nonObservers.find((p) => p.id === playerId);
  if (!player) return;

  // Don't allow selecting the same captain twice
  if (lobby.captainsDraft.captains.includes(playerId)) return;

  lobby.captainsDraft.captains.push(playerId);

  // If we have two captains, move to drafting phase
  if (lobby.captainsDraft.captains.length === 2) {
    lobby.captainsDraft.phase = "drafting";
    // Check if first captain must take all remaining players
    if (checkForcedPicks(lobby)) return;
  }

  broadcastCaptainsState();
};

export const randomCaptains = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) return;
  if (lobby.captainsDraft?.phase !== "selecting-captains") return;

  const nonObservers = getNonObserverPlayers(lobby);
  // Exclude any already-selected captains
  const available = nonObservers.filter(
    (p) => !lobby.captainsDraft!.captains.includes(p.id),
  );

  const needed = 2 - lobby.captainsDraft.captains.length;
  if (available.length < needed) return;

  // Randomly select needed captains
  for (let i = 0; i < needed; i++) {
    const idx = Math.floor(Math.random() * available.length);
    lobby.captainsDraft.captains.push(available[idx].id);
    available.splice(idx, 1);
  }

  lobby.captainsDraft.phase = "drafting";
  // Check if first captain must take all remaining players
  if (checkForcedPicks(lobby)) return;
  broadcastCaptainsState();
};

export const checkForcedPicks = (lobby: Lobby) => {
  const draft = lobby.captainsDraft!;
  const nonObservers = getNonObserverPlayers(lobby);
  const allPicked = [...draft.picks[0], ...draft.picks[1]];
  const remainingPool = nonObservers.filter(
    (p) => !draft.captains.includes(p.id) && !allPicked.includes(p.id),
  );

  // If current picker has enough picks to take all remaining players, auto-draft
  if (draft.picksThisTurn >= remainingPool.length && remainingPool.length > 0) {
    for (const p of remainingPool) {
      draft.picks[draft.currentPicker].push(p.id);
    }
    completeDraft(lobby);
    return true;
  }
  return false;
};

const completeDraft = (lobby: Lobby) => {
  const draft = lobby.captainsDraft!;

  // Captain 0 (first selected) becomes sheep, Captain 1 becomes wolf
  const captain0 = lobby.players.values().find(
    (p) => p.id === draft.captains[0],
  );
  const captain1 = lobby.players.values().find(
    (p) => p.id === draft.captains[1],
  );

  // Collect team updates to broadcast
  const updates: { id: string; team: "sheep" | "wolf" }[] = [];

  // Assign sheep (captain 0 + their picks)
  if (captain0) {
    captain0.team = "sheep";
    updates.push({ id: captain0.id, team: "sheep" });
  }
  for (const pickId of draft.picks[0]) {
    const player = lobby.players.values().find((p) => p.id === pickId);
    if (player) {
      player.team = "sheep";
      updates.push({ id: player.id, team: "sheep" });
    }
  }

  // Assign wolves (captain 1 + their picks)
  if (captain1) {
    captain1.team = "wolf";
    updates.push({ id: captain1.id, team: "wolf" });
  }
  for (const pickId of draft.picks[1]) {
    const player = lobby.players.values().find((p) => p.id === pickId);
    if (player) {
      player.team = "wolf";
      updates.push({ id: player.id, team: "wolf" });
    }
  }

  // Broadcast team changes to clients
  send({ type: "updates", updates });

  // Set sheep count to match the drafted team size and disable auto
  const sheepCount = 1 + draft.picks[0].length; // captain + picks
  lobby.settings.sheep = sheepCount;

  // Move to "drafted" phase - after first round, teams will auto-reverse
  lobby.captainsDraft = {
    phase: "drafted",
    captains: draft.captains,
    picks: draft.picks,
    currentPicker: 0,
    picksThisTurn: 0,
  };
  broadcastCaptainsState();
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};

const advanceDraft = (lobby: Lobby) => {
  const draft = lobby.captainsDraft!;
  const nonObservers = getNonObserverPlayers(lobby);
  const allPicked = [...draft.picks[0], ...draft.picks[1]];
  const remainingPool = nonObservers.filter(
    (p) => !draft.captains.includes(p.id) && !allPicked.includes(p.id),
  );

  if (remainingPool.length === 0) {
    completeDraft(lobby);
    return;
  }

  // Snake draft logic: 1-2-2-2-...-2-1
  draft.picksThisTurn--;
  if (draft.picksThisTurn === 0) {
    // Switch picker
    draft.currentPicker = draft.currentPicker === 0 ? 1 : 0;
    // Determine how many picks this turn
    // If only 1 player remains, it's 1 pick, otherwise 2
    draft.picksThisTurn = remainingPool.length === 1 ? 1 : 2;
  }

  // Auto-draft if current picker has enough picks to take all remaining players
  if (draft.picksThisTurn >= remainingPool.length) {
    for (const p of remainingPool) {
      draft.picks[draft.currentPicker].push(p.id);
    }
    completeDraft(lobby);
    return;
  }

  broadcastCaptainsState();
};

export const captainPick = (
  client: Client,
  { playerId }: z.TypeOf<typeof zCaptainPick>,
) => {
  const lobby = client.lobby;
  if (!lobby) return;
  if (lobby.captainsDraft?.phase !== "drafting") return;

  const draft = lobby.captainsDraft;

  // Only the current picker can pick
  const currentCaptainId = draft.captains[draft.currentPicker];
  if (client.id !== currentCaptainId) return;

  // Verify player is in the pool (not a captain, not already picked)
  const nonObservers = getNonObserverPlayers(lobby);
  const allPicked = [...draft.picks[0], ...draft.picks[1]];
  const pool = nonObservers.filter(
    (p) => !draft.captains.includes(p.id) && !allPicked.includes(p.id),
  );

  if (!pool.find((p) => p.id === playerId)) return;

  // Add player to current captain's team
  draft.picks[draft.currentPicker].push(playerId);

  advanceDraft(lobby);
};

export const isActiveCaptainsDraft = (lobby: Lobby) =>
  lobby.captainsDraft?.phase === "selecting-captains" ||
  lobby.captainsDraft?.phase === "drafting";

export const cancelCaptains = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) return;
  if (!isActiveCaptainsDraft(lobby)) return;

  lobby.captainsDraft = undefined;

  send({ type: "captainsDraft", phase: undefined });
};

/** Handle a non-observer player leaving during captains draft */
export const handleCaptainsPlayerLeave = (lobby: Lobby, playerId: string) => {
  const draft = lobby.captainsDraft;
  if (!draft) return;

  const allPicked = [...draft.picks[0], ...draft.picks[1]];
  const isCaptain = draft.captains.includes(playerId);
  const isDrafted = allPicked.includes(playerId);

  if (draft.phase === "selecting-captains") {
    // Remove from captains list if selected
    const captainIndex = draft.captains.indexOf(playerId);
    if (captainIndex !== -1) {
      draft.captains.splice(captainIndex, 1);
    }

    // Count remaining non-observer players (player already removed from lobby.players)
    const remainingNonObservers = getNonObserverPlayers(lobby).length;

    // Cancel if not enough players remain
    if (remainingNonObservers < 3) {
      lobby.captainsDraft = undefined;
      send({ type: "captainsDraft", phase: undefined });
    } else {
      broadcastCaptainsState();
    }
  } else if (draft.phase === "drafting") {
    // Cancel only if a captain or drafted player leaves
    if (isCaptain || isDrafted) {
      lobby.captainsDraft = undefined;
      send({ type: "captainsDraft", phase: undefined });
    } else {
      // Undrafted player left - check if remaining pool should be auto-drafted
      checkForcedPicks(lobby);
    }
  }
};

export const zReverseTeams = z.object({
  type: z.literal("reverseTeams"),
});

/** Swap sheep and wolf teams (host only, during drafted or reversed phase) */
export const reverseTeams = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) return;
  if (lobby.status !== "lobby") return;
  const phase = lobby.captainsDraft?.phase;
  if (phase !== "drafted" && phase !== "reversed") return;

  // Collect team updates to broadcast
  const updates: { id: string; team: "sheep" | "wolf" }[] = [];

  // Swap sheep and wolves
  for (const player of lobby.players) {
    if (player.team === "sheep") {
      player.team = "wolf";
      updates.push({ id: player.id, team: "wolf" });
    } else if (player.team === "wolf") {
      player.team = "sheep";
      updates.push({ id: player.id, team: "sheep" });
    }
  }

  // Update sheep count to match the new sheep team size
  const sheepCount =
    Array.from(lobby.players).filter((p) => p.team === "sheep").length;
  lobby.settings.sheep = sheepCount;

  // Broadcast updates
  send({ type: "updates", updates });
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};
