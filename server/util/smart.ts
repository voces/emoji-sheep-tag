export const smart = () => {
  // State tracking
  const sheepCount = new Map<string, number>();
  const pairCount = new Map<string, number>();
  const lastSheepRound = new Map<string, number>();
  let currentRound = 0;
  let lastPlayers: string[] = [];

  // Helper: shuffle array for randomization
  const shuffle = <T>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const n = Math.floor(Math.random() * (i + 1));
      [result[i], result[n]] = [result[n], result[i]];
    }
    return result;
  };

  // Undo support
  let lastSelection: string[] | null = null;
  let lastSheepCountSnapshot: Map<string, number> | null = null;
  let lastPairCountSnapshot: Map<string, number> | null = null;
  let lastSheepRoundSnapshot: Map<string, number> | null = null;
  let lastCurrentRound: number | null = null;

  // Perfect ordering cache
  const perfectOrderCache = new Map<string, string[][]>();
  let cachedSchedule: string[][] | null = null;
  let scheduleIndex = 0;

  // Helper: create sorted pair key
  const pairKey = (a: string, b: string): string => {
    return a < b ? `${a},${b}` : `${b},${a}`;
  };

  // Helper: roster signature for cache lookup
  const rosterSignature = (players: string[]): string => {
    return [...players].sort().join(",");
  };

  // Helper: calculate nCk
  const nChooseK = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result = result * (n - k + i) / i;
    }
    return Math.round(result);
  };

  // Helper: generate all k-combinations
  const getCombinations = <T>(arr: T[], k: number): T[][] => {
    if (k === 0) return [[]];
    if (k > arr.length) return [];
    const result: T[][] = [];
    const backtrack = (start: number, current: T[]) => {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      for (let i = start; i <= arr.length - (k - current.length); i++) {
        current.push(arr[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    };
    backtrack(0, []);
    return result;
  };

  // Perfect scheduler using fairCombinationOrder algorithm
  const computePerfectOrder = (players: string[], k: number): string[][] => {
    const n = players.length;
    const total = nChooseK(n, k);
    const order: string[][] = [];
    const used = new Set<string>();

    const playerToIdx = new Map<string, number>();
    const idxToPlayer = new Map<number, string>();
    players.forEach((p, i) => {
      playerToIdx.set(p, i + 1);
      idxToPlayer.set(i + 1, p);
    });

    const counts = Array<number>(n + 1).fill(0);
    const pairCountLocal = Array.from(
      { length: n + 1 },
      () => Array<number>(n + 1).fill(0),
    );
    const lastRoundLocal = new Map<number, number>();

    const teamToKey = (team: number[]): string =>
      [...team].sort((a, b) => a - b).join(",");

    const buildFairCandidates = (): number[][] => {
      let minC = Infinity, maxC = -Infinity;
      for (let i = 1; i <= n; i++) {
        if (counts[i] < minC) minC = counts[i];
        if (counts[i] > maxC) maxC = counts[i];
      }

      const L: number[] = [];
      const H: number[] = [];
      for (let i = 1; i <= n; i++) {
        if (counts[i] === minC) L.push(i);
        else H.push(i);
      }

      const cands: number[][] = [];
      if (L.length >= k) {
        const combs = getCombinations(L, k);
        cands.push(...combs);
      } else {
        const need = k - L.length;
        const fills = getCombinations(H, need);
        for (const add of fills) {
          const S = [...L, ...add].sort((a, b) => a - b);
          cands.push(S);
        }
      }

      return cands.filter((S) => !used.has(teamToKey(S)));
    };

    const pairProductPlusOne = (S: number[]): bigint => {
      if (k < 2) return 1n;
      let prod = 1n;
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const a = S[i], b = S[j];
          const u = a < b ? a : b, v = a < b ? b : a;
          const factor = BigInt(pairCountLocal[u][v] + 1);
          prod *= factor;
        }
      }
      return prod;
    };

    const consecutivePenalty = (S: number[], currentRound: number): number => {
      let penalty = 0;
      for (const playerIdx of S) {
        const last = lastRoundLocal.get(playerIdx);
        if (last !== undefined && currentRound - last === 1) {
          penalty += 1000;
        } else if (last !== undefined && currentRound - last <= 3) {
          penalty += Math.floor(100 / (currentRound - last));
        }
      }
      return penalty;
    };

    const apply = (S: number[]) => {
      const currentRound = order.length;
      used.add(teamToKey(S));
      order.push(S.map((idx) => idxToPlayer.get(idx)!));

      for (let i = 0; i < k; i++) counts[S[i]]++;
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const a = S[i], b = S[j];
          const u = a < b ? a : b, v = a < b ? b : a;
          pairCountLocal[u][v]++;
        }
      }
      for (const playerIdx of S) {
        lastRoundLocal.set(playerIdx, currentRound);
      }
    };

    const MAX_STATES = 10_000_000;
    let visitedStates = 0;

    const dfs = (): boolean => {
      if (order.length === total) return true;
      visitedStates++;
      if (visitedStates > MAX_STATES) return false;

      const cands = buildFairCandidates();
      const currentRound = order.length;
      const scored = cands.map((S) => ({
        S,
        pairCost: pairProductPlusOne(S),
        consecutiveCost: consecutivePenalty(S, currentRound),
      }));

      // Randomize before sorting to break ties randomly
      const randomized = shuffle(scored);

      randomized.sort((A, B) => {
        if (A.pairCost !== B.pairCost) return A.pairCost < B.pairCost ? -1 : 1;
        if (A.consecutiveCost !== B.consecutiveCost) {
          return A.consecutiveCost - B.consecutiveCost;
        }
        // Don't use lexicographic tiebreaker - let shuffle handle ties
        return 0;
      });

      for (const { S } of randomized) {
        const savedLastRound = new Map<number, number | undefined>();
        for (const playerIdx of S) {
          savedLastRound.set(playerIdx, lastRoundLocal.get(playerIdx));
        }

        apply(S);

        let minC = Infinity, maxC = -Infinity;
        for (let x = 1; x <= n; x++) {
          if (counts[x] < minC) minC = counts[x];
          if (counts[x] > maxC) maxC = counts[x];
        }

        if (maxC - minC <= 1 && dfs()) return true;

        // Rollback
        used.delete(teamToKey(S));
        order.pop();
        for (let i = 0; i < k; i++) counts[S[i]]--;
        for (let i = 0; i < k; i++) {
          for (let j = i + 1; j < k; j++) {
            const a = S[i], b = S[j];
            const u = a < b ? a : b, v = a < b ? b : a;
            pairCountLocal[u][v]--;
          }
        }
        for (const playerIdx of S) {
          const prev = savedLastRound.get(playerIdx);
          if (prev === undefined) {
            lastRoundLocal.delete(playerIdx);
          } else {
            lastRoundLocal.set(playerIdx, prev);
          }
        }
      }

      return false;
    };

    if (dfs()) {
      return order;
    }

    return [];
  };

  // Greedy selection for large teams
  const greedySelectTeam = (pool: string[], numToDraft: number): string[] => {
    const selected: string[] = [];

    const getTeamPairScore = (team: string[]): number => {
      let score = 0;
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = pairKey(team[i], team[j]);
          const count = pairCount.get(key) || 0;
          score += Math.pow(count + 1, 2);
        }
      }
      return score;
    };

    const getConsecutivePenalty = (team: string[]): number => {
      let penalty = 0;
      for (const player of team) {
        const lastRound = lastSheepRound.get(player);
        if (lastRound === undefined) continue;
        const gap = currentRound - lastRound;
        if (gap === 1) penalty += 1000;
        else if (gap <= 3) penalty += 100 / gap;
      }
      return penalty;
    };

    for (let i = 0; i < numToDraft; i++) {
      const candidates: string[] = [];
      let bestScore = Infinity;

      for (const player of pool) {
        if (selected.includes(player)) continue;

        const testTeam = [...selected, player];
        const pairScore = getTeamPairScore(testTeam);
        const consecutiveScore = getConsecutivePenalty(testTeam);
        const totalScore = pairScore * 1000 + consecutiveScore;

        if (totalScore < bestScore) {
          bestScore = totalScore;
          candidates.length = 0;
          candidates.push(player);
        } else if (totalScore === bestScore) {
          candidates.push(player);
        }
      }

      if (candidates.length === 0) {
        throw new Error("Failed to select player");
      }

      // Randomly select from tied candidates
      const bestPlayer =
        candidates[Math.floor(Math.random() * candidates.length)];
      selected.push(bestPlayer);
    }

    return selected.sort();
  };

  const draft = (allPlayers: string[], numToDraft: number): string[] => {
    // Save state for undo
    lastSheepCountSnapshot = new Map(sheepCount);
    lastPairCountSnapshot = new Map(pairCount);
    lastSheepRoundSnapshot = new Map(lastSheepRound);
    lastCurrentRound = currentRound;

    // Detect new players (not in previous roster)
    const previousPlayerSet = new Set(lastPlayers);
    const newPlayers = allPlayers.filter((p) => !previousPlayerSet.has(p));

    // Initialize new players
    if (newPlayers.length > 0) {
      // Get max sheepCount from recurring (non-new) players
      const recurringPlayers = allPlayers.filter((p) =>
        previousPlayerSet.has(p)
      );
      const recurringCounts = recurringPlayers
        .map((p) => sheepCount.get(p) || 0)
        .filter((c) => c > 0);

      const maxRecurringSheepCount = recurringCounts.length > 0
        ? Math.max(...recurringCounts)
        : 0;

      for (const newPlayer of newPlayers) {
        // Set sheepCount to max of recurring players
        sheepCount.set(newPlayer, maxRecurringSheepCount);

        // Update pairCount so new players have neutral preference (Criterion 2)
        // Set their pair counts to match the average pair count
        const allPairCounts = Array.from(pairCount.values());
        const avgPairCount = allPairCounts.length > 0
          ? Math.round(
            allPairCounts.reduce((a, b) => a + b, 0) / allPairCounts.length,
          )
          : 0;

        for (const otherPlayer of allPlayers) {
          if (otherPlayer !== newPlayer) {
            const key = pairKey(newPlayer, otherPlayer);
            if (!pairCount.has(key)) {
              pairCount.set(key, avgPairCount);
            }
          }
        }
      }
    }

    // Check if roster has changed
    const currentSig = rosterSignature(allPlayers);
    const lastSig = rosterSignature(lastPlayers);
    const rosterChanged = currentSig !== lastSig;

    if (rosterChanged) {
      // Roster changed - invalidate cache
      cachedSchedule = null;
      scheduleIndex = 0;
      lastPlayers = [...allPlayers];

      // Try to compute perfect order for small teams
      const shouldUsePerfect = numToDraft < 8 && allPlayers.length <= 20;

      if (shouldUsePerfect) {
        const sig = currentSig;
        if (perfectOrderCache.has(sig)) {
          cachedSchedule = perfectOrderCache.get(sig)!;
        } else {
          const perfectOrder = computePerfectOrder(allPlayers, numToDraft);

          if (perfectOrder.length > 0) {
            cachedSchedule = perfectOrder;
            perfectOrderCache.set(sig, perfectOrder);
          }
        }
      }
    }

    let selected: string[];

    // Use cached perfect schedule if available
    if (cachedSchedule && scheduleIndex < cachedSchedule.length) {
      selected = cachedSchedule[scheduleIndex];
      scheduleIndex++;
    } else {
      // Fall back to greedy selection
      const counts = allPlayers.map((p) => sheepCount.get(p) || 0);
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);

      const pool = allPlayers.filter((p) =>
        (sheepCount.get(p) || 0) === minCount
      );

      if (pool.length >= numToDraft) {
        selected = greedySelectTeam(pool, numToDraft);
      } else {
        const nextTier = allPlayers.filter((p) =>
          (sheepCount.get(p) || 0) === minCount + 1
        );

        if (pool.length + nextTier.length < numToDraft) {
          if (maxCount - minCount > 1) {
            throw new Error(
              "Balance constraint violated: cannot maintain max - min <= 1",
            );
          }
          throw new Error(
            `Not enough players to draft ${numToDraft} from ${allPlayers.length}`,
          );
        }

        const combined = [...pool, ...nextTier];
        selected = greedySelectTeam(combined, numToDraft);
      }
    }

    // Update state
    for (const player of selected) {
      sheepCount.set(player, (sheepCount.get(player) || 0) + 1);
      lastSheepRound.set(player, currentRound);
    }

    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const key = pairKey(selected[i], selected[j]);
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }

    currentRound++;
    lastSelection = selected;

    return selected;
  };

  const undo = (): void => {
    if (lastSelection === null) {
      throw new Error("No round to undo");
    }

    // Restore state
    if (lastSheepCountSnapshot) {
      sheepCount.clear();
      for (const [k, v] of lastSheepCountSnapshot) {
        sheepCount.set(k, v);
      }
    }

    if (lastPairCountSnapshot) {
      pairCount.clear();
      for (const [k, v] of lastPairCountSnapshot) {
        pairCount.set(k, v);
      }
    }

    if (lastSheepRoundSnapshot) {
      lastSheepRound.clear();
      for (const [k, v] of lastSheepRoundSnapshot) {
        lastSheepRound.set(k, v);
      }
    }

    if (lastCurrentRound !== null) {
      currentRound = lastCurrentRound;
    }

    // Rewind schedule index if using cached schedule
    if (scheduleIndex > 0) {
      scheduleIndex--;
    }

    // Clear undo state
    lastSelection = null;
    lastSheepCountSnapshot = null;
    lastPairCountSnapshot = null;
    lastSheepRoundSnapshot = null;
    lastCurrentRound = null;
  };

  const initializePlayer = (player: string, allPlayers?: string[]): void => {
    // If player already initialized, do nothing
    if (sheepCount.has(player)) {
      return;
    }

    // Get max sheepCount from existing players
    const existingCounts = Array.from(sheepCount.values());
    const maxSheepCount = existingCounts.length > 0
      ? Math.max(...existingCounts)
      : 0;

    // Initialize sheepCount
    sheepCount.set(player, maxSheepCount);

    // Initialize pairCount with neutral values
    const allPairCounts = Array.from(pairCount.values());
    const avgPairCount = allPairCounts.length > 0
      ? Math.round(
        allPairCounts.reduce((a, b) => a + b, 0) / allPairCounts.length,
      )
      : 0;

    // Set pair counts with all known players
    const knownPlayers = allPlayers || Array.from(sheepCount.keys());
    for (const otherPlayer of knownPlayers) {
      if (otherPlayer !== player) {
        const key = pairKey(player, otherPlayer);
        if (!pairCount.has(key)) {
          pairCount.set(key, avgPairCount);
        }
      }
    }

    // Add to lastPlayers if not already there
    if (!lastPlayers.includes(player)) {
      lastPlayers.push(player);
    }
  };

  const recordTeams = (sheepPlayers: string[]): void => {
    // Save state for undo
    lastSheepCountSnapshot = new Map(sheepCount);
    lastPairCountSnapshot = new Map(pairCount);
    lastSheepRoundSnapshot = new Map(lastSheepRound);
    lastCurrentRound = currentRound;

    // Update state with the given sheep team
    for (const player of sheepPlayers) {
      sheepCount.set(player, (sheepCount.get(player) || 0) + 1);
      lastSheepRound.set(player, currentRound);
    }

    for (let i = 0; i < sheepPlayers.length; i++) {
      for (let j = i + 1; j < sheepPlayers.length; j++) {
        const key = pairKey(sheepPlayers[i], sheepPlayers[j]);
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }

    currentRound++;
    lastSelection = sheepPlayers;
  };

  return { draft, undo, initializePlayer, recordTeams };
};
