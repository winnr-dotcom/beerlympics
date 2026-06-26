import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type Participant = {
  id: string;
  name: string;
  type: "individual" | "team";
  members: string | null;
  color: string;
  created_at: string;
};

export type Game = {
  id: string;
  name: string;
  scoring_type: "time" | "h2h";
  participant_type: "individual" | "team";
  status: "upcoming" | "group_stage" | "playoffs" | "completed";
  points_first: number;
  points_second: number;
  points_third: number;
  sort_order: number;
  updated_at: string;
};

export type TimeResult = {
  id: string;
  game_id: string;
  participant_id: string;
  time_seconds: number;
  updated_at: string;
};

export type H2HMatch = {
  id: string;
  game_id: string;
  participant_a: string | null;
  participant_b: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  stage: "group" | "playoff";
  bracket_slot: string | null;
  group_name: string | null;
  updated_at: string;
};

export type ParticipantGroup = {
  id: string;
  game_id: string;
  participant_id: string;
  group_name: "A" | "B";
};

export function formatTime(seconds: number): string {
  if (seconds == null || isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m.toString().padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

export function parseTime(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":");
    const mn = parseFloat(m);
    const sn = parseFloat(s);
    if (isNaN(mn) || isNaN(sn)) return null;
    return mn * 60 + sn;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

export function computeGameStandings(
  game: Game,
  participants: Participant[],
  timeResults: TimeResult[],
  h2hMatches: H2HMatch[],
): Array<{ participant: Participant; rank: number; points: number }> {
  const byId = new Map(participants.map((p) => [p.id, p]));
  let ranking: string[] = [];

  if (game.scoring_type === "time") {
    const res = timeResults
      .filter((r) => r.game_id === game.id)
      .slice()
      .sort((a, b) => a.time_seconds - b.time_seconds);
    ranking = res.map((r) => r.participant_id);
  } else {
    const playoff = h2hMatches.filter((m) => m.game_id === game.id && m.stage === "playoff");
    const finalMatch = playoff.find((m) => m.bracket_slot === "FINAL");
    const thirdMatch = playoff.find((m) => m.bracket_slot === "THIRD");

    if (finalMatch?.winner_id) {
      ranking.push(finalMatch.winner_id);
      const second =
        finalMatch.participant_a === finalMatch.winner_id
          ? finalMatch.participant_b
          : finalMatch.participant_a;
      if (second) ranking.push(second);
    }
    if (thirdMatch?.winner_id) ranking.push(thirdMatch.winner_id);

    if (ranking.length === 0) {
      const groupStats = computeGroupStandings(game, h2hMatches);
      ranking = groupStats.map((g) => g.participant_id);
    }
  }

  return ranking
    .map((id, i) => {
      const p = byId.get(id);
      if (!p) return null;
      const points =
        i === 0 ? game.points_first : i === 1 ? game.points_second : i === 2 ? game.points_third : 0;
      return { participant: p, rank: i + 1, points };
    })
    .filter(Boolean) as Array<{ participant: Participant; rank: number; points: number }>;
}

export function computeGroupStandings(game: Game, h2hMatches: H2HMatch[]) {
  const matches = h2hMatches.filter((m) => m.game_id === game.id && m.stage === "group");
  const stats = new Map<string, { participant_id: string; played: number; won: number; lost: number; points: number; group: string | null }>();
  const ensure = (id: string, group: string | null) => {
    if (!stats.has(id)) stats.set(id, { participant_id: id, played: 0, won: 0, lost: 0, points: 0, group });
    return stats.get(id)!;
  };
  for (const m of matches) {
    if (!m.participant_a || !m.participant_b || !m.winner_id) continue;
    const a = ensure(m.participant_a, m.group_name);
    const b = ensure(m.participant_b, m.group_name);
    a.played++; b.played++;
    if (m.winner_id === m.participant_a) { a.won++; b.lost++; a.points += 3; }
    else { b.won++; a.lost++; b.points += 3; }
  }
  return Array.from(stats.values()).sort((x, y) => y.points - x.points || y.won - x.won);
}

export function computeOverall(
  games: Game[],
  participants: Participant[],
  timeResults: TimeResult[],
  h2hMatches: H2HMatch[],
) {
  const totals = new Map<string, { participant: Participant; points: number; played: number; gold: number; silver: number; bronze: number }>();
  for (const p of participants) totals.set(p.id, { participant: p, points: 0, played: 0, gold: 0, silver: 0, bronze: 0 });

  for (const g of games) {
    const standings = computeGameStandings(g, participants, timeResults, h2hMatches);
    for (const s of standings) {
      const t = totals.get(s.participant.id);
      if (!t) continue;
      t.played++;
      t.points += s.points;
      if (g.status === "completed") {
        if (s.rank === 1) t.gold++;
        else if (s.rank === 2) t.silver++;
        else if (s.rank === 3) t.bronze++;
      }
    }
  }
  return Array.from(totals.values()).sort(
    (a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze,
  );
}

export function useBeerlympicsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("beerlympics-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () =>
        qc.invalidateQueries({ queryKey: ["beerlympics"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () =>
        qc.invalidateQueries({ queryKey: ["beerlympics"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "time_results" }, () =>
        qc.invalidateQueries({ queryKey: ["beerlympics"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "h2h_matches" }, () =>
        qc.invalidateQueries({ queryKey: ["beerlympics"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "participant_groups" }, () =>
        qc.invalidateQueries({ queryKey: ["beerlympics"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export async function fetchAll() {
  const [participants, games, timeResults, h2hMatches, groups] = await Promise.all([
    supabase.from("participants").select("*").order("name"),
    supabase.from("games").select("*").order("sort_order").order("created_at"),
    supabase.from("time_results").select("*"),
    supabase.from("h2h_matches").select("*"),
    supabase.from("participant_groups").select("*"),
  ]);
  if (participants.error) throw participants.error;
  if (games.error) throw games.error;
  if (timeResults.error) throw timeResults.error;
  if (h2hMatches.error) throw h2hMatches.error;
  if (groups.error) throw groups.error;
  return {
    participants: (participants.data ?? []) as Participant[],
    games: (games.data ?? []) as Game[],
    timeResults: (timeResults.data ?? []) as TimeResult[],
    h2hMatches: (h2hMatches.data ?? []) as H2HMatch[],
    groups: (groups.data ?? []) as ParticipantGroup[],
  };
}

export function lastUpdatedRecently(games: Game[], timeResults: TimeResult[], h2h: H2HMatch[]): boolean {
  const now = Date.now();
  const fiveMin = 5 * 60 * 1000;
  const all = [
    ...games.map((g) => g.updated_at),
    ...timeResults.map((t) => t.updated_at),
    ...h2h.map((h) => h.updated_at),
  ];
  return all.some((ts) => ts && now - new Date(ts).getTime() < fiveMin);
}
