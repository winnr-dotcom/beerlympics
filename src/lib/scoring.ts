import type {
  Contestant,
  BLGame,
  Round1Result,
  Round2Result,
  BonusPoint,
  TeamGamePlayer,
  TeamGameRanking,
  ChessboardMatch,
  GameResult,
  LeaderboardRow,
} from "./types";

const POINTS: Record<number, number> = {
  1: 11, 2: 10, 3: 9, 4: 8, 5: 7, 6: 6,
  7: 5,  8: 4,  9: 3, 10: 2, 11: 1,
};

// ── Individual game scoring ────────────────────────────────────

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

// ── Team game scoring (Popp Koppen + Chessboard) ──────────────

// Points for team rank 1-5:
// rank1 → 11/10, rank2 → 9/8, rank3 → 7/6, rank4 → 5/4, rank5 → 3/2
// displaced → 1

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
    // Teams not set yet
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  // Displaced player → rank 11 → 1 pt
  const displaced = gamePlayers.find((p) => p.is_displaced);
  if (displaced) {
    out[displaced.contestant_id] = { points: 1, isProvisional: false, rank: 11 };
  }

  // Ranked teams
  for (const ranking of gameRankings) {
    const members = gamePlayers.filter(
      (p) => p.team_number === ranking.team_number && !p.is_displaced,
    );
    if (members.length < 2) continue;

    const high = teamHighPts(ranking.rank!);
    const low  = teamLowPts(ranking.rank!);
    const highRank = (ranking.rank! - 1) * 2 + 1;
    const lowRank  = (ranking.rank! - 1) * 2 + 2;

    if (ranking.tiebreak_winner_id) {
      for (const p of members) {
        const isWinner = p.contestant_id === ranking.tiebreak_winner_id;
        out[p.contestant_id] = {
          points: isWinner ? high : low,
          isProvisional: false,
          rank: isWinner ? highRank : lowRank,
        };
      }
    } else {
      // Team rank known, tiebreaker pending → provisional (give lower pts)
      for (const p of members) {
        out[p.contestant_id] = { points: low, isProvisional: true, rank: highRank };
      }
    }
  }

  // Unranked team players → null
  const rankedTeams = new Set(gameRankings.map((r) => r.team_number));
  for (const p of gamePlayers) {
    if (!out[p.contestant_id]) {
      out[p.contestant_id] = { points: null, isProvisional: false, rank: null };
    }
  }

  // Fill any remaining contestants
  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }

  return out;
}

// ── Chessboard: derive team ranks from league matches ──────────

export function computeChessboardTeamRanks(
  gameId: string,
  matches: ChessboardMatch[],
): Map<number, number> {
  const gameMatches = matches.filter((m) => m.game_id === gameId && m.winner_team !== null);
  const wins: Map<number, number> = new Map([1, 2, 3, 4, 5].map((t) => [t, 0]));

  for (const m of gameMatches) {
    if (m.winner_team === 1) wins.set(m.team_a, (wins.get(m.team_a) ?? 0) + 1);
    if (m.winner_team === 2) wins.set(m.team_b, (wins.get(m.team_b) ?? 0) + 1);
  }

  const sorted = [...wins.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    // Tiebreak: head-to-head result
    const h2h = gameMatches.find(
      (m) => (m.team_a === a[0] && m.team_b === b[0]) || (m.team_a === b[0] && m.team_b === a[0]),
    );
    if (h2h) {
      const aWon =
        (h2h.team_a === a[0] && h2h.winner_team === 1) ||
        (h2h.team_b === a[0] && h2h.winner_team === 2);
      return aWon ? -1 : 1;
    }
    return a[0] - b[0]; // stable by team number
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

  // Build effective rankings: use league-computed rank + stored tiebreaker
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

  // If no matches played, fall back to stored manual ranks
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
): LeaderboardRow[] {
  const rows = contestants.map((contestant) => {
    const gameResults: Record<string, GameResult> = {};

    for (const game of games) {
      let all: Record<string, GameResult>;
      if (game.game_type === "individual") {
        all = computeGameResults(game.id, contestants, round1, round2);
      } else if (game.game_type === "team_chess") {
        all = computeChessboardResults(game.id, contestants, teamPlayers, teamRankings, chessboardMatches);
      } else {
        all = computeTeamGameResults(game.id, contestants, teamPlayers, teamRankings);
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
