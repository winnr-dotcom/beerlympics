import type {
  Contestant,
  BLGame,
  Round1Result,
  Round2Result,
  BonusPoint,
  GameResult,
  LeaderboardRow,
} from "./types";

const POINTS: Record<number, number> = {
  1: 11, 2: 10, 3: 9, 4: 8, 5: 7, 6: 6,
  7: 5,  8: 4,  9: 3, 10: 2, 11: 1,
};

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
    // Determine A/B brackets from R1
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

    // Contestants in R1 but not yet R2 → provisional
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

  // Fill missing with null
  for (const c of contestants) {
    if (!out[c.id]) {
      out[c.id] = { points: null, isProvisional: false, rank: null };
    }
  }

  return out;
}

export function computeLeaderboard(
  contestants: Contestant[],
  games: BLGame[],
  round1: Round1Result[],
  round2: Round2Result[],
  bonuses: BonusPoint[],
): LeaderboardRow[] {
  const rows = contestants.map((contestant) => {
    const gameResults: Record<string, GameResult> = {};
    for (const game of games) {
      const all = computeGameResults(game.id, contestants, round1, round2);
      gameResults[game.id] = all[contestant.id];
    }

    const bonusTotal = bonuses
      .filter((b) => b.contestant_id === contestant.id)
      .reduce((s, b) => s + b.points, 0);

    const gamePoints = Object.values(gameResults).reduce(
      (s, r) => s + (r.points ?? 0),
      0,
    );

    return { contestant, gameResults, bonusTotal, total: gamePoints + bonusTotal };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    // Tiebreak: count higher individual game rankings
    const countHigher = (row: typeof a, threshold: number) =>
      Object.values(row.gameResults).filter((r) => r.rank !== null && r.rank <= threshold && !r.isProvisional).length;
    for (const t of [3, 5, 8]) {
      const diff = countHigher(b, t) - countHigher(a, t);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

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
