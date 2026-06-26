import { supabase } from "@/integrations/supabase/client";
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
} from "./types";

export type FetchAllResult = {
  contestants: Contestant[];
  games: BLGame[];
  round1: Round1Result[];
  round2: Round2Result[];
  bonuses: BonusPoint[];
  teamPlayers: TeamGamePlayer[];
  teamRankings: TeamGameRanking[];
  chessboardMatches: ChessboardMatch[];
  livesStates: LivesGameState[];
  crockGroups: CrockGroup[];
  crockFinals: CrockFinal[];
};

export async function fetchAll(): Promise<FetchAllResult> {
  const [c, g, r1, r2, b, tp, tr, cm, ls, cg, cf] = await Promise.all([
    supabase.from("contestants").select("*").order("full_name"),
    supabase.from("bl_games").select("*").order("sort_order"),
    supabase.from("round1_results").select("*"),
    supabase.from("round2_results").select("*"),
    supabase.from("bonus_points").select("*"),
    supabase.from("team_game_players").select("*"),
    supabase.from("team_game_rankings").select("*"),
    supabase.from("chessboard_matches").select("*"),
    supabase.from("lives_game_state").select("*"),
    supabase.from("crock_groups").select("*"),
    supabase.from("crock_finals").select("*"),
  ]);

  return {
    contestants: (c.data ?? []) as Contestant[],
    games: (g.data ?? []) as BLGame[],
    round1: (r1.data ?? []) as Round1Result[],
    round2: (r2.data ?? []) as Round2Result[],
    bonuses: (b.data ?? []) as BonusPoint[],
    teamPlayers: (tp.data ?? []) as TeamGamePlayer[],
    teamRankings: (tr.data ?? []) as TeamGameRanking[],
    chessboardMatches: (cm.data ?? []) as ChessboardMatch[],
    livesStates: (ls.data ?? []) as LivesGameState[],
    crockGroups: (cg.data ?? []) as CrockGroup[],
    crockFinals: (cf.data ?? []) as CrockFinal[],
  };
}

export async function loginWithPin(pin: string): Promise<Contestant | null> {
  const { data, error } = await supabase
    .from("contestants")
    .select("*")
    .eq("pin_code", pin.trim())
    .single();

  if (error) {
    // PGRST116 = 0 rows returned = simply wrong PIN
    if (error.code === "PGRST116") return null;
    // Any other error = DB not reachable or migration not run
    throw new Error(
      error.code === "42P01"
        ? "Database not set up — run the SQL migration in Supabase first."
        : `Database error: ${error.message}`,
    );
  }

  return data as Contestant;
}

export async function updateContestantProfile(
  id: string,
  updates: { nickname?: string; photo_url?: string },
) {
  return supabase.from("contestants").update(updates).eq("id", id);
}

export async function uploadAvatar(contestantId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${contestantId}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

// ── Individual game times ──────────────────────────────────────

export async function upsertRound1(contestantId: string, gameId: string, timeSeconds: number) {
  return supabase.from("round1_results").upsert(
    { contestant_id: contestantId, game_id: gameId, time_seconds: timeSeconds, updated_at: new Date().toISOString() },
    { onConflict: "contestant_id,game_id" },
  );
}

export async function upsertRound2(contestantId: string, gameId: string, timeSeconds: number) {
  return supabase.from("round2_results").upsert(
    { contestant_id: contestantId, game_id: gameId, time_seconds: timeSeconds, updated_at: new Date().toISOString() },
    { onConflict: "contestant_id,game_id" },
  );
}

export async function deleteRound1(contestantId: string, gameId: string) {
  return supabase
    .from("round1_results")
    .delete()
    .eq("contestant_id", contestantId)
    .eq("game_id", gameId);
}

export async function deleteRound2(contestantId: string, gameId: string) {
  return supabase
    .from("round2_results")
    .delete()
    .eq("contestant_id", contestantId)
    .eq("game_id", gameId);
}

// ── Team game setup ───────────────────────────────────────────

export async function saveTeamAssignments(
  gameId: string,
  assignments: { contestantId: string; teamNumber: number; isDisplaced: boolean }[],
) {
  // Delete existing, then insert fresh
  await supabase.from("team_game_players").delete().eq("game_id", gameId);
  return supabase.from("team_game_players").insert(
    assignments.map((a) => ({
      game_id: gameId,
      contestant_id: a.contestantId,
      team_number: a.teamNumber,
      is_displaced: a.isDisplaced,
    })),
  );
}

export async function upsertTeamRanking(
  gameId: string,
  teamNumber: number,
  rank: number | null,
  tiebreakWinnerId?: string | null,
) {
  return supabase.from("team_game_rankings").upsert(
    {
      game_id: gameId,
      team_number: teamNumber,
      rank,
      tiebreak_winner_id: tiebreakWinnerId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,team_number" },
  );
}

// ── Chessboard matches ────────────────────────────────────────

export async function upsertChessboardMatch(
  gameId: string,
  teamA: number,
  teamB: number,
  playerAId: string | null,
  playerBId: string | null,
  scoreA: number | null,
  scoreB: number | null,
) {
  const winnerTeam =
    scoreA === null || scoreB === null ? null :
    scoreA > scoreB ? 1 :
    scoreA < scoreB ? 2 : 0;
  return supabase.from("chessboard_matches").upsert(
    {
      game_id: gameId,
      team_a: teamA,
      team_b: teamB,
      player_a_id: playerAId,
      player_b_id: playerBId,
      score_a: scoreA,
      score_b: scoreB,
      winner_team: winnerTeam,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,team_a,team_b" },
  );
}

// ── Lives games (Foot Tennis, Slap Cup) ───────────────────────

export async function upsertLivesState(
  gameId: string,
  contestantId: string,
  initialLives: number,
  currentLives: number,
  eliminatedOrder: number | null,
) {
  return supabase.from("lives_game_state").upsert(
    {
      game_id: gameId,
      contestant_id: contestantId,
      initial_lives: initialLives,
      current_lives: currentLives,
      eliminated_order: eliminatedOrder,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,contestant_id" },
  );
}

export async function resetLivesGame(gameId: string) {
  return supabase.from("lives_game_state").delete().eq("game_id", gameId);
}

export async function resetRound2ForGame(gameId: string) {
  return supabase.from("round2_results").delete().eq("game_id", gameId);
}

// ── Crock it group stage ──────────────────────────────────────

export async function upsertCrockGroup(
  gameId: string,
  contestantId: string,
  groupNumber: number,
  timeSeconds: number | null,
  advances: boolean | null,
  stage: "r1" | "r2" = "r1",
) {
  return supabase.from("crock_groups").upsert(
    {
      game_id: gameId,
      contestant_id: contestantId,
      group_number: groupNumber,
      stage,
      time_seconds: timeSeconds,
      advances,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,contestant_id,group_number,stage" },
  );
}

export async function saveCrockAssignments(
  gameId: string,
  assignments: { contestantId: string; groupNumber: number }[],
) {
  await supabase.from("crock_groups").delete().eq("game_id", gameId).eq("stage", "r1");
  return supabase.from("crock_groups").insert(
    assignments.map((a) => ({
      game_id: gameId,
      contestant_id: a.contestantId,
      group_number: a.groupNumber,
      stage: "r1",
      time_seconds: null,
      advances: null,
    })),
  );
}

export async function saveCrockR2Assignments(
  gameId: string,
  assignments: { contestantId: string; groupNumber: number }[],
) {
  await supabase.from("crock_groups").delete().eq("game_id", gameId).eq("stage", "r2");
  if (assignments.length === 0) return { error: null };
  return supabase.from("crock_groups").insert(
    assignments.map((a) => ({
      game_id: gameId,
      contestant_id: a.contestantId,
      group_number: a.groupNumber,
      stage: "r2",
      time_seconds: null,
      advances: null,
    })),
  );
}

export async function upsertCrockFinal(
  contestantId: string,
  gameId: string,
  stage: "final" | "consol_r2" | "consol_r1",
  timeSeconds: number,
) {
  return supabase.from("crock_finals").upsert(
    {
      game_id: gameId,
      contestant_id: contestantId,
      stage,
      time_seconds: timeSeconds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,contestant_id,stage" },
  );
}

export async function deleteCrockFinal(
  contestantId: string,
  gameId: string,
  stage: "final" | "consol_r2" | "consol_r1",
) {
  return supabase.from("crock_finals").delete()
    .eq("game_id", gameId)
    .eq("contestant_id", contestantId)
    .eq("stage", stage);
}

export async function resetCrockGame(gameId: string) {
  await supabase.from("crock_groups").delete().eq("game_id", gameId);
  await supabase.from("crock_finals").delete().eq("game_id", gameId);
}

export async function resetChessboardGame(gameId: string) {
  await supabase.from("chessboard_matches").delete().eq("game_id", gameId);
  await supabase.from("team_game_rankings").delete().eq("game_id", gameId);
}

// ── Bonus points ─────────────────────────────────────────────

export async function addBonus(contestantId: string, points: number, reason: string) {
  return supabase.from("bonus_points").insert({ contestant_id: contestantId, points, reason });
}

export async function deleteBonus(id: string) {
  return supabase.from("bonus_points").delete().eq("id", id);
}
