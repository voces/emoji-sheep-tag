import { useMemo } from "react";
import type { Player } from "@/shared/api/player.ts";
import type { Round } from "@/shared/round.ts";

export type BulldogPlayerStats = {
  solo: number;
  team: number;
  leaks: number;
};

export type PlayerStats = {
  /** For non-bulldog modes: rounds the player was on the sheep team in the current bucket. */
  playerRoundsMap: Map<string, ReadonlyArray<Round>>;
  /** Players tied for the highest average round duration in the current bucket. */
  bestAverageIds: Set<string>;
  /** Players tied for the longest single round in the current bucket. */
  longestRoundIds: Set<string>;
  /** Each player's longest round in the current bucket, if any. */
  longestRoundByPlayer: Map<string, Round>;
  /** Aggregated bulldog Solo/Team/Leaks counts per player for the current bucket. */
  bulldogStats: Map<string, BulldogPlayerStats>;
};

/**
 * Derives per-player stats from the rounds list, bucketed by the current
 * (sheepCount, wolfCount) team config. Survival/vip rounds feed the average
 * & longest-round columns; bulldog rounds feed Solo/Team/Leaks.
 */
export const usePlayerStats = (
  players: ReadonlyArray<Player>,
  rounds: ReadonlyArray<Round>,
): PlayerStats =>
  useMemo(() => {
    const sheepCount = players.filter((p) => p.team === "sheep").length;
    const wolfCount = players.filter((p) => p.team === "wolf").length;
    const inBucket = (r: Round) =>
      r.sheep.length === sheepCount && r.wolves.length === wolfCount;
    const survivalRounds = rounds.filter((r) =>
      r.mode !== "bulldog" && inBucket(r)
    );
    const bulldogRounds = rounds.filter((r) =>
      r.mode === "bulldog" && inBucket(r)
    );

    const playerRoundsMap = new Map<string, ReadonlyArray<Round>>();
    for (const p of players) {
      playerRoundsMap.set(
        p.id,
        survivalRounds.filter((r) => r.sheep.includes(p.id)),
      );
    }

    let bestAvg = 0;
    let bestAvgIds: string[] = [];
    let longestDuration = 0;
    let longestIds: string[] = [];
    const longestRoundByPlayer = new Map<string, Round>();
    for (const [id, pRounds] of playerRoundsMap) {
      if (!pRounds.length) continue;
      const avg = pRounds.reduce((s, r) => s + r.duration, 0) / pRounds.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestAvgIds = [id];
      } else if (avg === bestAvg) bestAvgIds.push(id);

      let max = pRounds[0];
      for (const r of pRounds) if (r.duration > max.duration) max = r;
      longestRoundByPlayer.set(id, max);
      if (max.duration > longestDuration) {
        longestDuration = max.duration;
        longestIds = [id];
      } else if (max.duration === longestDuration) longestIds.push(id);
    }

    const bulldogStats = new Map<string, BulldogPlayerStats>();
    for (const p of players) {
      bulldogStats.set(p.id, { solo: 0, team: 0, leaks: 0 });
    }
    for (const r of bulldogRounds) {
      const goals = r.events?.filter((e) => e.type === "goal") ?? [];
      if (goals.length === 0) continue;
      for (const id of r.sheep) {
        const s = bulldogStats.get(id);
        if (!s) continue;
        s.team += goals.length;
      }
      for (const goal of goals) {
        const s = bulldogStats.get(goal.player);
        if (s) s.solo += 1;
      }
      for (const id of r.wolves) {
        const s = bulldogStats.get(id);
        if (!s) continue;
        s.leaks += goals.length;
      }
    }

    return {
      playerRoundsMap,
      bestAverageIds: new Set(bestAvgIds),
      longestRoundIds: new Set(longestIds),
      longestRoundByPlayer,
      bulldogStats,
    };
  }, [players, rounds]);
