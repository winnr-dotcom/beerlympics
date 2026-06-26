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
};

export async function fetchAll(): Promise<FetchAllResult> {
  const [c, g, r1, r2, b, tp, tr, cm] = await Promise.all([
    supabase.from("contestants").select("*").order("full_name"),
    supabase.from("bl_games").select("*").order("sort_order"),
    supabase.from("round1_results").select("*"),
    supabase.from("round2_results").select("*"),
    supabase.from("bonus_points").select("*"),
    supabase.from("team_game_players").select("*"),
    supabase.from("team_game_rankings").select("*"),
    supabase.from("chessboard_matches").select("*"),
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
  winnerTeam: number | null,
) {
  return supabase.from("chessboard_matches").upsert(
    {
      game_id: gameId,
      team_a: teamA,
      team_b: teamB,
      player_a_id: playerAId,
      player_b_id: playerBId,
      winner_team: winnerTeam,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,team_a,team_b" },
  );
}

// ── Bonus points ─────────────────────────────────────────────

export async function addBonus(contestantId: string, points: number, reason: string) {
  return supabase.from("bonus_points").insert({ contestant_id: contestantId, points, reason });
}

export async function deleteBonus(id: string) {
  return supabase.from("bonus_points").delete().eq("id", id);
}
