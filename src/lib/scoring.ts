import type {
  Contestant,
  BLGame,
  Round1Result,
  Round2Result,
  BonusPoint,
  TeamGamePlayer,
  TeamGameRanking,
  ChessboardMatch,
  LivesGameState,
  CrockGroup,
  GameResult,
  LeaderboardRow,
} from "./types";

const POINTS: Record<number, number> = {
  1: 11, 2: 10, 3: 9, 4: 8, 5: 7, 6: 6,
  7: 5,  8: 4,  9: 3, 10: 2, 11: 1,
};

// ── Individual time game (lower is better) ────────────────────

export function computeGameResults(
  gameId: string,
  contestants: Contestant[],
  round1: Round1Result[],
  round2: Round2Result[],
): Record<string, GameResult> {
  const r1 = round1.filter((r) => r.game_id === gameId);
  const r2 = round2.filter((r) => r.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (r2.length > 0 && r1.length >= 6) {
    const r1sorted = [...r1].sort((a, b) => a.time_seconds - b.time_seconds);
    const bracketA = new Set(r1sorted.slice(0, 6).map((r) => r.contestant_id));

    const r2A = r2.filter((r) => bracketA.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);
    const r2B = r2.filter((r) => !bracketA.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);

    r2A.forEach((r, i) => {
      out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 };
    });
    r2B.forEach((r, i) => {
      out[r.contestant_id] = { points: POINTS[i + 7] ?? 0, isProvisional: false, rank: i + 7 };
    });

    for (const r of r1sorted) {
      if (!out[r.contestant_id]) {
        const rank = r1sorted.findIndex((x) => x.contestant_id === r.contestant_id) + 1;
        out[r.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: true, rank };
      }
    }
  } else if (r1.length > 0) {
    const sorted = [...r1].sort((a, b) => a.time_seconds - b.time_seconds);
    sorted.forEach((r, i) => {
      out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: true, rank: i + 1 };
    });
  }

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }

  return out;
}

// ── Individual points game (higher is better, e.g. Can Baseball) ──

export function computePointsGameResults(
  gameId: string,
  contestants: Contestant[],
  round1: Round1Result[],
  round2: Round2Result[],
): Record<string, GameResult> {
  const r1 = round1.filter((r) => r.game_id === gameId);
  const r2 = round2.filter((r) => r.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (r2.length > 0 && r1.length >= 6) {
    // higher score = better rank → sort descending
    const r1sorted = [...r1].sort((a, b) => b.time_seconds - a.time_seconds);
    const bracketA = new Set(r1sorted.slice(0, 6).map((r) => r.contestant_id));

    const r2A = r2.filter((r) => bracketA.has(r.contestant_id)).sort((a, b) => b.time_seconds - a.time_seconds);
    const r2B = r2.filter((r) => !bracketA.has(r.contestant_id)).sort((a, b) => b.time_seconds - a.time_seconds);

    r2A.forEach((r, i) => { out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 }; });
    r2B.forEach((r, i) => { out[r.contestant_id] = { points: POINTS[i + 7] ?? 0, isProvisional: false, rank: i + 7 }; });

    for (const r of r1sorted) {
      if (!out[r.contestant_id]) {
        const rank = r1sorted.findIndex((x) => x.contestant_id === r.contestant_id) + 1;
        out[r.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: true, rank };
      }
    }
  } else if (r1.length > 0) {
    const sorted = [...r1].sort((a, b) => b.time_seconds - a.time_seconds);
    sorted.forEach((r, i) => { out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: true, rank: i + 1 }; });
  }

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Lives game (Foot Tennis, Slap Cup) ────────────────────────
// Elimination order 1 = first out = position 11
// Remaining 6 go to playoffs (round2 determines positions 1-6)

export function computeLivesGameResults(
  gameId: string,
  contestants: Contestant[],
  livesStates: LivesGameState[],
  round2: Round2Result[],
): Record<string, GameResult> {
  const states = livesStates.filter((s) => s.game_id === gameId);
  const r2 = round2.filter((r) => r.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (states.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  // Eliminated players: order 1=last place (pos 11), order N=position (12-N)
  const eliminated = states.filter((s) => s.eliminated_order !== null)
    .sort((a, b) => a.eliminated_order! - b.eliminated_order!);
  const alive = states.filter((s) => s.eliminated_order === null)
    .sort((a, b) => b.current_lives - a.current_lives); // more lives = better bracket seed

  // Positions 7-11 from elimination (no round 2 needed for these)
  eliminated.forEach((s, i) => {
    const rank = 11 - i; // first eliminated = rank 11
    out[s.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: eliminated.length < 5, rank };
  });

  // Positions 1-6 from round 2 (playoffs among survivors)
  if (r2.length > 0) {
    // Top 6 survivors sorted by round2 time
    const aliveIds = new Set(alive.map((s) => s.contestant_id));
    const r2alive = r2.filter((r) => aliveIds.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);
    r2alive.forEach((r, i) => {
      out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 };
    });
    // Still-alive players not in round 2 yet: provisional by lives
    alive.forEach((s, i) => {
      if (!out[s.contestant_id]) {
        out[s.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: true, rank: i + 1 };
      }
    });
  } else {
    // No playoffs yet: provisional by lives count
    alive.forEach((s, i) => {
      out[s.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: true, rank: i + 1 };
    });
  }

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Crock it cup format ────────────────────────────────────────
// Group stage → top 2 per group advance + best 3rd (wildcard)
// Knockout in round2_results

export function computeCupGameResults(
  gameId: string,
  contestants: Contestant[],
  crockGroups: CrockGroup[],
  round2: Round2Result[],
): Record<string, GameResult> {
  const groups = crockGroups.filter((g) => g.game_id === gameId);
  const r2 = round2.filter((r) => r.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (groups.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  // Determine who advanced (from groups with advances=true, or compute if not set)
  const qualifiers = new Set<string>();
  const nonQualifiers: string[] = [];

  const grouped = new Map<number, CrockGroup[]>();
  for (const g of groups) {
    if (!grouped.has(g.group_number)) grouped.set(g.group_number, []);
    grouped.get(g.group_number)!.push(g);
  }

  // If advances flags are set, use them
  const hasAdvancesFlags = groups.some((g) => g.advances !== null);
  if (hasAdvancesFlags) {
    for (const g of groups) {
      if (g.advances) qualifiers.add(g.contestant_id);
      else nonQualifiers.push(g.contestant_id);
    }
  } else if (groups.some((g) => g.time_seconds !== null)) {
    // Auto-compute: top 2 per group + best 3rd overall
    const thirds: CrockGroup[] = [];
    for (const [, members] of grouped) {
      const sorted = members.filter((m) => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
      sorted.slice(0, 2).forEach((m) => qualifiers.add(m.contestant_id));
      if (sorted[2]) thirds.push(sorted[2]);
    }
    // Best 3rd overall (lowest time)
    if (thirds.length > 0) {
      const bestThird = [...thirds].sort((a, b) => a.time_seconds! - b.time_seconds!)[0];
      qualifiers.add(bestThird.contestant_id);
    }
    for (const g of groups) {
      if (!qualifiers.has(g.contestant_id)) nonQualifiers.push(g.contestant_id);
    }
  }

  // Knockout (round2) for qualifiers
  if (r2.length > 0) {
    const r2quals = r2.filter((r) => qualifiers.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);
    r2quals.forEach((r, i) => { out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 }; });
  }

  // Non-qualifiers: rank by group position
  const nonQSorted = nonQualifiers
    .map((id) => ({ id, time: groups.find((g) => g.contestant_id === id)?.time_seconds ?? 99999 }))
    .sort((a, b) => a.time - b.time);
  const qualCount = r2.length > 0 ? r2.filter((r) => qualifiers.has(r.contestant_id)).length : 0;
  nonQSorted.forEach((entry, i) => {
    if (!out[entry.id]) {
      const rank = (qualifiers.size) + i + 1;
      out[entry.id] = { points: POINTS[rank] ?? 0, isProvisional: qualCount < qualifiers.size, rank };
    }
  });

  // Provisionally rank qualifiers not yet in round2
  let nextQRank = r2.filter((r) => qualifiers.has(r.contestant_id)).length + 1;
  for (const id of qualifiers) {
    if (!out[id]) {
      out[id] = { points: POINTS[nextQRank] ?? 0, isProvisional: true, rank: nextQRank++ };
    }
  }

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Team game scoring ──────────────────────────────────────────

function teamHighPts(rank: number) { return 13 - 2 * rank; }
function teamLowPts(rank: number)  { return 12 - 2 * rank; }

export function computeTeamGameResults(
  gameId: string,
  contestants: Contestant[],
  teamPlayers: TeamGamePlayer[],
  teamRankings: TeamGameRanking[],
): Record<string, GameResult> {
  const gamePlayers = teamPlayers.filter((p) => p.game_id === gameId);
  const gameRankings = teamRankings.filter((r) => r.game_id === gameId && r.rank !== null);
  const out: Record<string, GameResult> = {};

  if (gamePlayers.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  const displaced = gamePlayers.find((p) => p.is_displaced);
  if (displaced) {
    out[displaced.contestant_id] = { points: 1, isProvisional: false, rank: 11 };
  }

  for (const ranking of gameRankings) {
    const members = gamePlayers.filter((p) => p.team_number === ranking.team_number && !p.is_displaced);
    if (members.length < 2) continue;

    const high = teamHighPts(ranking.rank!);
    const low  = teamLowPts(ranking.rank!);
    const highRank = (ranking.rank! - 1) * 2 + 1;
    const lowRank  = (ranking.rank! - 1) * 2 + 2;

    if (ranking.tiebreak_winner_id) {
      for (const p of members) {
        const isWinner = p.contestant_id === ranking.tiebreak_winner_id;
        out[p.contestant_id] = { points: isWinner ? high : low, isProvisional: false, rank: isWinner ? highRank : lowRank };
      }
    } else {
      for (const p of members) {
        out[p.contestant_id] = { points: low, isProvisional: true, rank: highRank };
      }
    }
  }

  const rankedTeams = new Set(gameRankings.map((r) => r.team_number));
  for (const p of gamePlayers) {
    if (!out[p.contestant_id]) out[p.contestant_id] = { points: null, isProvisional: false, rank: null };
  }
  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Chessboard: derive team ranks from league matches ──────────
// Points: win=3, draw=1, loss=0. Tiebreak: goal difference, then head-to-head

export function computeChessboardTeamRanks(
  gameId: string,
  matches: ChessboardMatch[],
): Map<number, number> {
  const gameMatches = matches.filter((m) => m.game_id === gameId && m.winner_team !== null);

  const pts   = new Map<number, number>([1, 2, 3, 4, 5].map((t) => [t, 0]));
  const gf    = new Map<number, number>([1, 2, 3, 4, 5].map((t) => [t, 0])); // goals for
  const ga    = new Map<number, number>([1, 2, 3, 4, 5].map((t) => [t, 0])); // goals against

  for (const m of gameMatches) {
    const sa = m.score_a ?? 0, sb = m.score_b ?? 0;
    gf.set(m.team_a, (gf.get(m.team_a) ?? 0) + sa);
    ga.set(m.team_a, (ga.get(m.team_a) ?? 0) + sb);
    gf.set(m.team_b, (gf.get(m.team_b) ?? 0) + sb);
    ga.set(m.team_b, (ga.get(m.team_b) ?? 0) + sa);

    if (m.winner_team === 1) {
      pts.set(m.team_a, (pts.get(m.team_a) ?? 0) + 3);
    } else if (m.winner_team === 2) {
      pts.set(m.team_b, (pts.get(m.team_b) ?? 0) + 3);
    } else if (m.winner_team === 0) {
      pts.set(m.team_a, (pts.get(m.team_a) ?? 0) + 1);
      pts.set(m.team_b, (pts.get(m.team_b) ?? 0) + 1);
    }
  }

  const sorted = [...pts.entries()].sort((a, b) => {
    const pd = b[1] - a[1];
    if (pd !== 0) return pd;
    // Goal difference tiebreak
    const gdA = (gf.get(a[0]) ?? 0) - (ga.get(a[0]) ?? 0);
    const gdB = (gf.get(b[0]) ?? 0) - (ga.get(b[0]) ?? 0);
    if (gdB !== gdA) return gdB - gdA;
    // Head-to-head
    const h2h = gameMatches.find(
      (m) => (m.team_a === a[0] && m.team_b === b[0]) || (m.team_a === b[0] && m.team_b === a[0]),
    );
    if (h2h) {
      const aWon = (h2h.team_a === a[0] && h2h.winner_team === 1) || (h2h.team_b === a[0] && h2h.winner_team === 2);
      return aWon ? -1 : 1;
    }
    return a[0] - b[0];
  });

  const ranks = new Map<number, number>();
  sorted.forEach(([team], i) => ranks.set(team, i + 1));
  return ranks;
}

export function computeChessboardResults(
  gameId: string,
  contestants: Contestant[],
  teamPlayers: TeamGamePlayer[],
  teamRankings: TeamGameRanking[],
  chessboardMatches: ChessboardMatch[],
): Record<string, GameResult> {
  const leagueRanks = computeChessboardTeamRanks(gameId, chessboardMatches);
  const storedRankings = teamRankings.filter((r) => r.game_id === gameId);

  const effectiveRankings: TeamGameRanking[] = [];
  for (const [team, rank] of leagueRanks) {
    const stored = storedRankings.find((r) => r.team_number === team);
    effectiveRankings.push({
      id: stored?.id ?? "",
      game_id: gameId,
      team_number: team,
      rank,
      tiebreak_winner_id: stored?.tiebreak_winner_id ?? null,
      updated_at: "",
    });
  }

  if (chessboardMatches.filter((m) => m.game_id === gameId && m.winner_team !== null).length === 0) {
    return computeTeamGameResults(gameId, contestants, teamPlayers, storedRankings);
  }
  return computeTeamGameResults(gameId, contestants, teamPlayers, effectiveRankings);
}

// ── Main leaderboard computation ──────────────────────────────

export function computeLeaderboard(
  contestants: Contestant[],
  games: BLGame[],
  round1: Round1Result[],
  round2: Round2Result[],
  bonuses: BonusPoint[],
  teamPlayers: TeamGamePlayer[] = [],
  teamRankings: TeamGameRanking[] = [],
  chessboardMatches: ChessboardMatch[] = [],
  livesStates: LivesGameState[] = [],
  crockGroups: CrockGroup[] = [],
): LeaderboardRow[] {
  const rows = contestants.map((contestant) => {
    const gameResults: Record<string, GameResult> = {};

    for (const game of games) {
      let all: Record<string, GameResult>;
      switch (game.game_type) {
        case "individual":
          all = computeGameResults(game.id, contestants, round1, round2);
          break;
        case "individual_points":
          all = computePointsGameResults(game.id, contestants, round1, round2);
          break;
        case "lives_bracket":
          all = computeLivesGameResults(game.id, contestants, livesStates, round2);
          break;
        case "cup_format":
          all = computeCupGameResults(game.id, contestants, crockGroups, round2);
          break;
        case "team_chess":
          all = computeChessboardResults(game.id, contestants, teamPlayers, teamRankings, chessboardMatches);
          break;
        case "team_popp":
          all = computeTeamGameResults(game.id, contestants, teamPlayers, teamRankings);
          break;
        default:
          all = computeGameResults(game.id, contestants, round1, round2);
      }
      gameResults[game.id] = all[contestant.id] ?? { points: null, isProvisional: false, rank: null };
    }

    const bonusTotal = bonuses
      .filter((b) => b.contestant_id === contestant.id)
      .reduce((s, b) => s + b.points, 0);

    const gamePoints = Object.values(gameResults).reduce((s, r) => s + (r.points ?? 0), 0);
    return { contestant, gameResults, bonusTotal, total: gamePoints + bonusTotal };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const countTop = (row: typeof a, n: number) =>
      Object.values(row.gameResults).filter((r) => r.rank !== null && r.rank <= n && !r.isProvisional).length;
    for (const t of [3, 5, 8]) {
      const d = countTop(b, t) - countTop(a, t);
      if (d !== 0) return d;
    }
    return 0;
  });

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

// ── Helpers ───────────────────────────────────────────────────

export function getBrackets(gameId: string, round1: Round1Result[]) {
  const r1 = round1
    .filter((r) => r.game_id === gameId)
    .sort((a, b) => a.time_seconds - b.time_seconds);
  return {
    bracketA: r1.slice(0, 6).map((r) => r.contestant_id),
    bracketB: r1.slice(6).map((r) => r.contestant_id),
  };
}

export function getLivesBrackets(gameId: string, livesStates: LivesGameState[]) {
  const states = livesStates.filter((s) => s.game_id === gameId);
  const alive = states.filter((s) => s.eliminated_order === null)
    .sort((a, b) => b.current_lives - a.current_lives);
  const eliminated = states.filter((s) => s.eliminated_order !== null)
    .sort((a, b) => a.eliminated_order! - b.eliminated_order!);
  return {
    bracketA: alive.map((s) => s.contestant_id),
    bracketB: eliminated.map((s) => s.contestant_id),
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, "0");
  return mins > 0 ? `${mins}:${secs}` : `${secs}s`;
}

export function parseTime(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":");
    const v = parseInt(m, 10) * 60 + parseFloat(s);
    return isNaN(v) ? null : v;
  }
  const v = parseFloat(trimmed);
  return isNaN(v) ? null : v;
}

// All 10 round-robin pairs for 5 teams
export const CHESS_PAIRS: [number, number][] = [
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 3], [2, 4], [2, 5],
  [3, 4], [3, 5],
  [4, 5],
];
