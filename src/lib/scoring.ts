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
  CrockFinal,
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

// ── Direct points (the number you enter IS the score, e.g. Crock it) ──
// No rank→points mapping: whatever the admin types is added to the leaderboard
// as-is. Stored in round1_results.time_seconds. Rank is by points (desc) only
// for ordering/medals; points are never transformed.

export function computeDirectPointsResults(
  gameId: string,
  contestants: Contestant[],
  round1: Round1Result[],
): Record<string, GameResult> {
  const rows = round1.filter((r) => r.game_id === gameId);
  const sorted = [...rows].sort((a, b) => b.time_seconds - a.time_seconds);
  const rankOf = new Map<string, number>();
  sorted.forEach((r, i) => rankOf.set(r.contestant_id, i + 1));

  const out: Record<string, GameResult> = {};
  for (const c of contestants) {
    const row = rows.find((r) => r.contestant_id === c.id);
    out[c.id] = row
      ? { points: row.time_seconds, isProvisional: false, rank: rankOf.get(c.id) ?? null }
      : { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Individual race (lower is better, R1 = final, no playoff) ─

export function computeRaceResults(
  gameId: string,
  contestants: Contestant[],
  round1: Round1Result[],
): Record<string, GameResult> {
  const r1 = round1.filter((r) => r.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (r1.length > 0) {
    const sorted = [...r1].sort((a, b) => a.time_seconds - b.time_seconds);
    sorted.forEach((r, i) => {
      out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 };
    });
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

  const eliminated = states.filter((s) => s.eliminated_order !== null)
    .sort((a, b) => a.eliminated_order! - b.eliminated_order!);
  const alive = states.filter((s) => s.eliminated_order === null)
    .sort((a, b) => b.current_lives - a.current_lives);

  const aliveIds = new Set(alive.map((s) => s.contestant_id));
  const r2alive = r2.filter((r) => aliveIds.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);
  const r2elim  = r2.filter((r) => !aliveIds.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);

  // Positions 1-6: round2 times for survivors (provisional by lives if no round2)
  r2alive.forEach((r, i) => {
    out[r.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 };
  });
  alive.forEach((s, i) => {
    if (!out[s.contestant_id]) {
      out[s.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: true, rank: i + 1 };
    }
  });

  // Positions 7-11: round2 times if entered, else elimination order
  if (r2elim.length > 0) {
    r2elim.forEach((r, i) => {
      out[r.contestant_id] = { points: POINTS[i + 7] ?? 0, isProvisional: false, rank: i + 7 };
    });
    eliminated.forEach((s) => {
      if (!out[s.contestant_id]) {
        const rank = 11 - eliminated.indexOf(s);
        out[s.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: true, rank };
      }
    });
  } else {
    eliminated.forEach((s, i) => {
      const rank = 11 - i;
      out[s.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: eliminated.length < 5, rank };
    });
  }

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Lives game, no playoff (Slap Cup) ─────────────────────────
// When 5 eliminated: ranks 7-11 by elimination order, ranks 1-6 by lives remaining.
// All scores final once 5 are eliminated.

export function computeNoPlayoffLivesResults(
  gameId: string,
  contestants: Contestant[],
  livesStates: LivesGameState[],
): Record<string, GameResult> {
  const states = livesStates.filter((s) => s.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (states.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  const eliminated = states
    .filter((s) => s.eliminated_order !== null)
    .sort((a, b) => a.eliminated_order! - b.eliminated_order!);
  const alive = states
    .filter((s) => s.eliminated_order === null)
    .sort((a, b) => b.current_lives - a.current_lives);

  const isDone = eliminated.length >= 5;

  eliminated.forEach((s, i) => {
    const rank = 11 - i;
    out[s.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: !isDone, rank };
  });
  alive.forEach((s, i) => {
    const rank = i + 1;
    out[s.contestant_id] = { points: POINTS[rank] ?? 0, isProvisional: !isDone, rank };
  });

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Crock it cup format ────────────────────────────────────────
// R1: 4 groups (A=1,B=2,C=3,D=4); top 2 from each advance (wildcard in D)
// R2: 2 groups of 4; top 2 → Final; bottom 2 → R2 Consolation (pos 5-8)
// Final: positions 1-4 | R1 Consolation: 3 R1 losers for positions 9-11

export function computeCupGameResults(
  gameId: string,
  contestants: Contestant[],
  crockGroups: CrockGroup[],
  crockFinals: CrockFinal[],
): Record<string, GameResult> {
  const r1Groups = crockGroups.filter((g) => g.game_id === gameId && g.stage === "r1");
  const r2Groups = crockGroups.filter((g) => g.game_id === gameId && g.stage === "r2");
  const finals   = crockFinals.filter((f) => f.game_id === gameId && f.stage === "final");
  const consolR2 = crockFinals.filter((f) => f.game_id === gameId && f.stage === "consol_r2");
  const consolR1 = crockFinals.filter((f) => f.game_id === gameId && f.stage === "consol_r1");
  const out: Record<string, GameResult> = {};

  if (r1Groups.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  // ── Final scoring (if entered) ────────────────────────────────
  finals.sort((a, b) => a.time_seconds! - b.time_seconds!).forEach((f, i) => {
    out[f.contestant_id] = { points: POINTS[i + 1] ?? 0, isProvisional: false, rank: i + 1 };
  });
  consolR2.sort((a, b) => a.time_seconds! - b.time_seconds!).forEach((f, i) => {
    out[f.contestant_id] = { points: POINTS[i + 5] ?? 0, isProvisional: false, rank: i + 5 };
  });
  consolR1.sort((a, b) => a.time_seconds! - b.time_seconds!).forEach((f, i) => {
    out[f.contestant_id] = { points: POINTS[i + 9] ?? 0, isProvisional: false, rank: i + 9 };
  });

  // ── R1 qualification ──────────────────────────────────────────
  // Top 2 from each group advance; ties broken by admin (advances flag)
  const r1Grouped = new Map<number, CrockGroup[]>();
  for (const g of r1Groups) {
    if (!r1Grouped.has(g.group_number)) r1Grouped.set(g.group_number, []);
    r1Grouped.get(g.group_number)!.push(g);
  }

  const r1Qualifiers = new Set<string>();
  const r1Seen = new Set<string>(); // deduplicate players in multiple groups (wildcard)

  for (const [, members] of r1Grouped) {
    const sorted = members.filter((m) => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
    sorted.slice(0, 2).forEach((m) => r1Qualifiers.add(m.contestant_id));
    members.forEach((m) => r1Seen.add(m.contestant_id));
  }
  // Admin overrides
  for (const g of r1Groups) {
    if (g.advances === true) r1Qualifiers.add(g.contestant_id);
    if (g.advances === false) r1Qualifiers.delete(g.contestant_id);
  }

  // R1 non-qualifiers: players seen in R1 groups but not qualifying
  // A wildcard who appears in both A/B and D: only count as non-qualifier if not in r1Qualifiers
  const r1NonQualifiers = [...r1Seen].filter((id) => !r1Qualifiers.has(id));

  // ── R2 group scoring (provisional if finals not yet entered) ──
  if (r2Groups.length > 0) {
    const r2Grouped = new Map<number, CrockGroup[]>();
    for (const g of r2Groups) {
      if (!r2Grouped.has(g.group_number)) r2Grouped.set(g.group_number, []);
      r2Grouped.get(g.group_number)!.push(g);
    }

    const r2FinalQuals: string[] = [];
    const r2ConsolQuals: string[] = [];
    for (const [, members] of r2Grouped) {
      const sorted = members.filter((m) => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
      sorted.slice(0, 2).forEach((m) => r2FinalQuals.push(m.contestant_id));
      sorted.slice(2).forEach((m) => r2ConsolQuals.push(m.contestant_id));
    }

    r2FinalQuals.forEach((id, i) => {
      if (!out[id]) out[id] = { points: POINTS[i + 1] ?? 0, isProvisional: true, rank: i + 1 };
    });
    r2ConsolQuals.forEach((id, i) => {
      if (!out[id]) out[id] = { points: POINTS[i + 5] ?? 0, isProvisional: true, rank: i + 5 };
    });
    // R2 players assigned but not yet timed
    let nextR2 = r2FinalQuals.length + r2ConsolQuals.length + 1;
    for (const g of r2Groups) {
      if (!out[g.contestant_id]) {
        out[g.contestant_id] = { points: POINTS[nextR2] ?? 0, isProvisional: true, rank: nextR2++ };
      }
    }
  } else {
    // No R2 yet: provisionally rank R1 qualifiers 1-8
    let rank = 1;
    for (const id of r1Qualifiers) {
      if (!out[id]) out[id] = { points: POINTS[rank] ?? 0, isProvisional: true, rank: rank++ };
    }
  }

  // ── R1 consolation provisional (positions 9-11) ───────────────
  if (consolR1.length === 0) {
    const sorted = r1NonQualifiers
      .map((id) => ({ id, time: r1Groups.filter((g) => g.contestant_id === id).map((g) => g.time_seconds).find((t) => t !== null) ?? 99999 }))
      .sort((a, b) => a.time - b.time);
    sorted.forEach(({ id }, i) => {
      if (!out[id]) out[id] = { points: POINTS[i + 9] ?? 0, isProvisional: true, rank: i + 9 };
    });
  }

  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Team game scoring ──────────────────────────────────────────
// Supports mixed teams: pair teams consume 2 position slots, solo teams consume 1.
// Teams are sorted by rank, then positions are assigned sequentially so totals
// always sum to positions 1–11 regardless of where the solo team finishes.

export function computeTeamGameResults(
  gameId: string,
  contestants: Contestant[],
  teamPlayers: TeamGamePlayer[],
  teamRankings: TeamGameRanking[],
): Record<string, GameResult> {
  const gamePlayers = teamPlayers.filter((p) => p.game_id === gameId);
  const gameRankings = teamRankings
    .filter((r) => r.game_id === gameId && r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!);
  const out: Record<string, GameResult> = {};

  if (gamePlayers.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  let position = 1;
  for (const ranking of gameRankings) {
    const members = gamePlayers.filter((p) => p.team_number === ranking.team_number);
    if (members.length === 0) continue;

    if (members.length === 1) {
      out[members[0].contestant_id] = { points: POINTS[position] ?? 0, isProvisional: false, rank: position };
      position += 1;
    } else {
      const highPts = POINTS[position] ?? 0;
      const lowPts  = POINTS[position + 1] ?? 0;
      if (ranking.tiebreak_winner_id) {
        for (const p of members) {
          const isWinner = p.contestant_id === ranking.tiebreak_winner_id;
          out[p.contestant_id] = { points: isWinner ? highPts : lowPts, isProvisional: false, rank: isWinner ? position : position + 1 };
        }
      } else {
        for (const p of members) {
          out[p.contestant_id] = { points: lowPts, isProvisional: true, rank: position };
        }
      }
      position += 2;
    }
  }

  for (const p of gamePlayers) {
    if (!out[p.contestant_id]) out[p.contestant_id] = { points: null, isProvisional: false, rank: null };
  }
  for (const c of contestants) {
    if (!out[c.id]) out[c.id] = { points: null, isProvisional: false, rank: null };
  }
  return out;
}

// ── Popp Koppen: time-based team scoring ──────────────────────
// R1: all teams race, rank by time (lower = better).
// Playoff: top-half race for final 1..half ranks; bottom-half for half+1..n ranks.
// Pair teams consume two individual point slots; tiebreak splits them.

export function computePoppKoppenResults(
  gameId: string,
  contestants: Contestant[],
  teamPlayers: TeamGamePlayer[],
  teamRankings: TeamGameRanking[],
): Record<string, GameResult> {
  const gamePlayers = teamPlayers.filter((p) => p.game_id === gameId);
  const gameRankings = teamRankings.filter((r) => r.game_id === gameId);
  const out: Record<string, GameResult> = {};

  if (gamePlayers.length === 0) {
    for (const c of contestants) out[c.id] = { points: null, isProvisional: false, rank: null };
    return out;
  }

  const activeTeams = [...new Set(gamePlayers.map((p) => p.team_number))].sort((a, b) => a - b);
  const n = activeTeams.length;
  const half = Math.ceil(n / 2);

  const r1Map = new Map<number, number>(
    gameRankings.filter((r) => r.r1_time_seconds != null).map((r) => [r.team_number, r.r1_time_seconds!]),
  );
  const playoffMap = new Map<number, number>(
    gameRankings.filter((r) => r.playoff_time_seconds != null).map((r) => [r.team_number, r.playoff_time_seconds!]),
  );

  const r1Sorted = [...activeTeams].filter((t) => r1Map.has(t)).sort((a, b) => r1Map.get(a)! - r1Map.get(b)!);
  const allR1Done = r1Sorted.length === n;

  // Build final ordered team list with provisional flag
  let finalOrder: { teamNum: number; provisional: boolean }[];
  if (!allR1Done) {
    finalOrder = r1Sorted.map((t) => ({ teamNum: t, provisional: true }));
  } else {
    const topG = r1Sorted.slice(0, half);
    const botG = r1Sorted.slice(half);
    const topPO = [...topG].filter((t) => playoffMap.has(t)).sort((a, b) => playoffMap.get(a)! - playoffMap.get(b)!);
    const botPO = [...botG].filter((t) => playoffMap.has(t)).sort((a, b) => playoffMap.get(a)! - playoffMap.get(b)!);
    finalOrder = [
      ...(topPO.length === topG.length ? topPO : topG).map((t) => ({ teamNum: t, provisional: topPO.length < topG.length })),
      ...(botPO.length === botG.length ? botPO : botG).map((t) => ({ teamNum: t, provisional: botPO.length < botG.length })),
    ];
  }

  // Assign individual points (pair teams consume two position slots)
  let position = 1;
  for (const { teamNum, provisional } of finalOrder) {
    const members = gamePlayers.filter((p) => p.team_number === teamNum);
    const ranking = gameRankings.find((r) => r.team_number === teamNum);
    if (members.length === 1) {
      out[members[0].contestant_id] = { points: POINTS[position] ?? 0, isProvisional: provisional, rank: position };
      position += 1;
    } else {
      const highPts = POINTS[position] ?? 0;
      const lowPts = POINTS[position + 1] ?? 0;
      if (ranking?.tiebreak_winner_id && !provisional) {
        for (const m of members) {
          const isWinner = m.contestant_id === ranking.tiebreak_winner_id;
          out[m.contestant_id] = { points: isWinner ? highPts : lowPts, isProvisional: false, rank: isWinner ? position : position + 1 };
        }
      } else {
        for (const m of members) {
          out[m.contestant_id] = { points: lowPts, isProvisional: true, rank: position };
        }
      }
      position += 2;
    }
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

  const pts   = new Map<number, number>([1, 2, 3, 4, 5, 6].map((t) => [t, 0]));
  const gf    = new Map<number, number>([1, 2, 3, 4, 5, 6].map((t) => [t, 0]));
  const ga    = new Map<number, number>([1, 2, 3, 4, 5, 6].map((t) => [t, 0]));

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
      r1_time_seconds: null,
      playoff_time_seconds: null,
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
  crockFinals: CrockFinal[] = [],
): LeaderboardRow[] {
  const rows = contestants.map((contestant) => {
    const gameResults: Record<string, GameResult> = {};

    for (const game of games) {
      let all: Record<string, GameResult>;
      switch (game.game_type) {
        case "individual":
          all = computeGameResults(game.id, contestants, round1, round2);
          break;
        case "individual_race":
          all = computeRaceResults(game.id, contestants, round1);
          break;
        case "individual_points":
          all = computePointsGameResults(game.id, contestants, round1, round2);
          break;
        case "lives_bracket":
          all = computeLivesGameResults(game.id, contestants, livesStates, round2);
          break;
        case "lives_no_playoff":
          all = computeNoPlayoffLivesResults(game.id, contestants, livesStates);
          break;
        case "cup_format":
          // Crock it = pure direct points entry
          all = computeDirectPointsResults(game.id, contestants, round1);
          break;
        case "team_chess":
          all = computeChessboardResults(game.id, contestants, teamPlayers, teamRankings, chessboardMatches);
          break;
        case "team_popp":
          all = computePoppKoppenResults(game.id, contestants, teamPlayers, teamRankings);
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
  const secs = (seconds % 60).toFixed(3).padStart(6, "0");
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

// All 15 round-robin pairs for 6 teams — interleaved so every team plays every 3rd match
// (polygon rotation method; 3 matches per round × 5 rounds)
export const CHESS_PAIRS: [number, number][] = [
  [1, 6], [2, 5], [3, 4],  // Round 1
  [1, 5], [4, 6], [2, 3],  // Round 2
  [1, 4], [3, 5], [2, 6],  // Round 3
  [1, 3], [2, 4], [5, 6],  // Round 4
  [1, 2], [3, 6], [4, 5],  // Round 5
];
