import { supabase } from "@/integrations/supabase/client";
import type { Contestant, BLGame, Round1Result, Round2Result, BonusPoint } from "./types";

export type FetchAllResult = {
  contestants: Contestant[];
  games: BLGame[];
  round1: Round1Result[];
  round2: Round2Result[];
  bonuses: BonusPoint[];
};

export async function fetchAll(): Promise<FetchAllResult> {
  const [c, g, r1, r2, b] = await Promise.all([
    supabase.from("contestants").select("*").order("full_name"),
    supabase.from("bl_games").select("*").order("sort_order"),
    supabase.from("round1_results").select("*"),
    supabase.from("round2_results").select("*"),
    supabase.from("bonus_points").select("*"),
  ]);

  return {
    contestants: (c.data ?? []) as Contestant[],
    games: (g.data ?? []) as BLGame[],
    round1: (r1.data ?? []) as Round1Result[],
    round2: (r2.data ?? []) as Round2Result[],
    bonuses: (b.data ?? []) as BonusPoint[],
  };
}

export async function loginWithPin(pin: string): Promise<Contestant | null> {
  const { data } = await supabase
    .from("contestants")
    .select("*")
    .eq("pin_code", pin.trim())
    .single();
  return data as Contestant | null;
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

export async function addBonus(contestantId: string, points: number, reason: string) {
  return supabase.from("bonus_points").insert({ contestant_id: contestantId, points, reason });
}

export async function deleteBonus(id: string) {
  return supabase.from("bonus_points").delete().eq("id", id);
}
