import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAll, type FetchAllResult } from "@/lib/api";
import { computeLeaderboard, formatTime, getBrackets, computeChessboardTeamRanks, CHESS_PAIRS } from "@/lib/scoring";
import { useAuth } from "@/lib/auth";
import type { LeaderboardRow, BLGame } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: LeaderboardPage,
});

const SHORT: Record<string, string> = {
  "Hinderløypen": "HIND",
  "Can Baseball":  "CAN",
  "Popp Koppen":   "POPP",
  "Labyrinten":    "LAB",
  "Foot-Tennis":   "FOOT",
  "Crock it":      "CROCK",
  "Chessboard":    "CHESS",
  "Slap Cup":      "SLAP",
};

function Avatar({ name, photo_url }: { name: string; photo_url: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  const hue = initial.charCodeAt(0) * 37;
  return photo_url ? (
    <img src={photo_url} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0 border border-zinc-700" />
  ) : (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ backgroundColor: `hsl(${hue % 360} 50% 40%)` }}
    >
      {initial}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl leading-none">🥇</span>;
  if (rank === 2) return <span className="text-xl leading-none">🥈</span>;
  if (rank === 3) return <span className="text-xl leading-none">🥉</span>;
  return <span className="text-sm font-semibold text-zinc-400">{rank}</span>;
}

function GameCell({ row, gameId }: { row: LeaderboardRow; gameId: string }) {
  const r = row.gameResults[gameId];
  if (!r || r.points === null) {
    return <td className="px-2 py-3 text-center text-zinc-600 text-sm">–</td>;
  }
  const pts = r.points;
  const prov = r.isProvisional;
  const colorClass = prov
    ? "text-zinc-500 italic"
    : pts >= 9
    ? "text-amber-400"
    : pts >= 6
    ? "text-amber-600"
    : "text-zinc-300";

  return (
    <td className="px-2 py-3 text-center text-sm" title={prov ? "Provisional (Round 1 only)" : `Rank ${r.rank}`}>
      <span className={`font-semibold tabular-nums ${colorClass}`}>
        {pts}
        {prov && <sup className="text-[9px] not-italic text-zinc-600">P</sup>}
      </span>
    </td>
  );
}

function BracketCard({ game, data }: { game: BLGame; data: FetchAllResult }) {
  const { bracketA, bracketB } = getBrackets(game.id, data.round1);
  const r1 = data.round1.filter((r) => r.game_id === game.id).sort((a, b) => a.time_seconds - b.time_seconds);
  const r2 = data.round2.filter((r) => r.game_id === game.id);

  const getName = (id: string) => {
    const c = data.contestants.find((c) => c.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  const makeRows = (ids: string[]) =>
    ids.map((id) => ({
      id,
      name: getName(id),
      r1Time: r1.find((r) => r.contestant_id === id)?.time_seconds ?? null,
      r2Time: r2.find((r) => r.contestant_id === id)?.time_seconds ?? null,
    }));

  const aRows = makeRows(bracketA).sort((a, b) =>
    a.r2Time !== null && b.r2Time !== null ? a.r2Time - b.r2Time :
    a.r2Time !== null ? -1 : b.r2Time !== null ? 1 :
    (a.r1Time ?? 99999) - (b.r1Time ?? 99999)
  );
  const bRows = makeRows(bracketB).sort((a, b) =>
    a.r2Time !== null && b.r2Time !== null ? a.r2Time - b.r2Time :
    a.r2Time !== null ? -1 : b.r2Time !== null ? 1 :
    (a.r1Time ?? 99999) - (b.r1Time ?? 99999)
  );

  const hasR2 = r2.length > 0;

  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      <h3 className="mb-3 font-bold text-amber-400 text-sm">{game.name}</h3>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="mb-1.5 font-semibold text-green-400">🏆 Top 6</div>
          {aRows.map((e, i) => (
            <div key={e.id} className="flex justify-between py-0.5">
              <span className="text-zinc-300">{i + 1}. {e.name}</span>
              <span className="text-zinc-500 tabular-nums">
                {hasR2 ? (e.r2Time !== null ? formatTime(e.r2Time) : "–") : (e.r1Time !== null ? formatTime(e.r1Time) : "–")}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1.5 font-semibold text-zinc-400">Bottom 5</div>
          {bRows.map((e, i) => (
            <div key={e.id} className="flex justify-between py-0.5">
              <span className="text-zinc-300">{i + 1}. {e.name}</span>
              <span className="text-zinc-500 tabular-nums">
                {hasR2 ? (e.r2Time !== null ? formatTime(e.r2Time) : "–") : (e.r1Time !== null ? formatTime(e.r1Time) : "–")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal helpers ─────────────────────────────────────────────

function MRow({ rank, name, value, top, badge, badgeColor }: {
  rank: number | null; name: string; value: string;
  top?: boolean; badge?: string; badgeColor?: string;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30 ${top ? "bg-amber-950/20" : ""}`}>
      <span className="text-xs font-bold text-zinc-500 w-5 text-right shrink-0">{rank ?? "–"}</span>
      <span className="flex-1 text-sm text-zinc-200">{name}</span>
      {badge && <span className={`text-xs shrink-0 ${badgeColor ?? "text-zinc-500"}`}>{badge}</span>}
      <span className={`text-sm tabular-nums shrink-0 ${value === "–" ? "text-zinc-600" : "text-zinc-300"}`}>{value}</span>
    </div>
  );
}
function MSec({ label, color }: { label: string; color: string }) {
  return <div className={`px-4 py-2 text-xs font-semibold border-b border-zinc-800/50 ${color}`}>{label}</div>;
}
function MEmpty({ msg }: { msg: string }) {
  return <p className="text-center py-10 text-zinc-600 text-sm">{msg}</p>;
}

// ── Game progress modal ───────────────────────────────────────

function GameProgressModal({ game, data, onClose }: { game: BLGame; data: FetchAllResult; onClose: () => void }) {
  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  // ── Individual time (Labyrinten, Hinderløypen) ──
  const renderIndividual = () => {
    const r1 = data.round1.filter((r) => r.game_id === game.id).sort((a, b) => a.time_seconds - b.time_seconds);
    const r2 = data.round2.filter((r) => r.game_id === game.id).sort((a, b) => a.time_seconds - b.time_seconds);
    const { bracketA, bracketB } = getBrackets(game.id, data.round1);
    const hasPlayoffs = game.game_type !== "individual_race" && bracketA.length >= 6;
    if (r1.length === 0) return <MEmpty msg="No times recorded yet" />;
    if (r2.length > 0 && hasPlayoffs) {
      const r2A = r2.filter((r) => bracketA.includes(r.contestant_id));
      const r2B = r2.filter((r) => bracketB.includes(r.contestant_id));
      const pendingA = bracketA.filter((id) => !r2A.some((r) => r.contestant_id === id));
      const pendingB = bracketB.filter((id) => !r2B.some((r) => r.contestant_id === id));
      return (<>
        <MSec label="🏆 Top 6" color="text-green-400" />
        {r2A.map((r, i) => <MRow key={r.id} rank={i+1} name={getName(r.contestant_id)} value={formatTime(r.time_seconds)} top={i===0} />)}
        {pendingA.map((id) => <MRow key={id} rank={null} name={getName(id)} value="–" />)}
        <MSec label="Bottom 5" color="text-zinc-400" />
        {r2B.map((r, i) => <MRow key={r.id} rank={i+7} name={getName(r.contestant_id)} value={formatTime(r.time_seconds)} />)}
        {pendingB.map((id) => <MRow key={id} rank={null} name={getName(id)} value="–" />)}
      </>);
    }
    const notYet = data.contestants.filter((c) => !r1.some((r) => r.contestant_id === c.id));
    return (<>
      <div className="px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800/40">
        {r1.length}/11{game.game_type === "individual_race" ? " · best time wins" : hasPlayoffs ? " · playoffs unlocked ✓" : ` · ${11 - r1.length} more for playoffs`}
      </div>
      {r1.map((r, i) => <MRow key={r.id} rank={i+1} name={getName(r.contestant_id)} value={formatTime(r.time_seconds)} top={i===0} />)}
      {notYet.map((c) => <MRow key={c.id} rank={null} name={getName(c.id)} value="–" />)}
    </>);
  };

  // ── Can Baseball (points, higher=better) ──
  const renderPoints = () => {
    const r1 = data.round1.filter((r) => r.game_id === game.id).sort((a, b) => b.time_seconds - a.time_seconds);
    const r2 = data.round2.filter((r) => r.game_id === game.id).sort((a, b) => b.time_seconds - a.time_seconds);
    const bracketAIds = new Set(r1.slice(0, 6).map((r) => r.contestant_id));
    if (r1.length === 0) return <MEmpty msg="No scores recorded yet" />;
    if (r1.length >= 11 && r2.length > 0) {
      const r2A = r2.filter((r) => bracketAIds.has(r.contestant_id));
      const r2B = r2.filter((r) => !bracketAIds.has(r.contestant_id));
      return (<>
        <MSec label="🏆 Top 6" color="text-green-400" />
        {r2A.map((r, i) => <MRow key={r.id} rank={i+1} name={getName(r.contestant_id)} value={String(r.time_seconds)} top={i===0} />)}
        <MSec label="Bottom 5" color="text-zinc-400" />
        {r2B.map((r, i) => <MRow key={r.id} rank={i+7} name={getName(r.contestant_id)} value={String(r.time_seconds)} />)}
      </>);
    }
    return (<>
      <div className="px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800/40">{r1.length}/11 · higher is better</div>
      {r1.map((r, i) => <MRow key={r.id} rank={i+1} name={getName(r.contestant_id)} value={String(r.time_seconds)} top={i===0} />)}
      {data.contestants.filter((c) => !r1.some((r) => r.contestant_id === c.id)).map((c) => (
        <MRow key={c.id} rank={null} name={getName(c.id)} value="–" />
      ))}
    </>);
  };

  // ── Lives games ──
  const renderLives = () => {
    const states = data.livesStates.filter((s) => s.game_id === game.id);
    const r2 = data.round2.filter((r) => r.game_id === game.id);
    if (states.length === 0) return <MEmpty msg="Game not started yet" />;
    const alive = states.filter((s) => s.eliminated_order === null).sort((a, b) => b.current_lives - a.current_lives);
    const elim = states.filter((s) => s.eliminated_order !== null).sort((a, b) => b.eliminated_order! - a.eliminated_order!);
    const aliveSet = new Set(alive.map((s) => s.contestant_id));
    // Playoff results
    if (game.game_type === "lives_bracket" && r2.length > 0) {
      const r2Top = r2.filter((r) => aliveSet.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);
      const r2Bot = r2.filter((r) => !aliveSet.has(r.contestant_id)).sort((a, b) => a.time_seconds - b.time_seconds);
      return (<>
        <MSec label="🏆 Top 6 — Playoffs" color="text-green-400" />
        {r2Top.map((r, i) => <MRow key={r.id} rank={i+1} name={getName(r.contestant_id)} value={formatTime(r.time_seconds)} top={i===0} />)}
        {alive.filter((s) => !r2Top.some((r) => r.contestant_id === s.contestant_id)).map((s) => (
          <MRow key={s.id} rank={null} name={getName(s.contestant_id)} value="not run" />
        ))}
        {(r2Bot.length > 0 || elim.length > 0) && <MSec label="Bottom 5" color="text-zinc-400" />}
        {r2Bot.map((r, i) => <MRow key={r.id} rank={i+7} name={getName(r.contestant_id)} value={formatTime(r.time_seconds)} />)}
        {elim.filter((s) => !r2Bot.some((r) => r.contestant_id === s.contestant_id)).map((s) => (
          <MRow key={s.id} rank={null} name={getName(s.contestant_id)} value="–" />
        ))}
      </>);
    }
    return (<>
      {alive.length > 0 && <>
        <MSec label={`❤️ Playing — ${alive.length} left`} color="text-green-400" />
        {alive.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30">
            <span className="flex-1 text-sm font-medium text-zinc-200">{getName(s.contestant_id)}</span>
            <div className="flex gap-1.5">
              {Array.from({ length: s.initial_lives }).map((_, i) => (
                <div key={i} className={`h-4 w-4 rounded-full ${i < s.current_lives ? "bg-red-500" : "bg-zinc-700"}`} />
              ))}
            </div>
          </div>
        ))}
      </>}
      {elim.length > 0 && <>
        <MSec label={`Out — ${elim.length}/5`} color="text-zinc-500" />
        {elim.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30 opacity-60">
            <span className="text-xs font-bold text-zinc-600 w-5 text-right shrink-0">{12 - s.eliminated_order!}</span>
            <span className="flex-1 text-sm text-zinc-400">{getName(s.contestant_id)}</span>
            <div className="flex gap-1.5">
              {Array.from({ length: s.initial_lives }).map((_, i) => (
                <div key={i} className="h-4 w-4 rounded-full bg-zinc-700" />
              ))}
            </div>
          </div>
        ))}
      </>}
    </>);
  };

  // ── Crock it ──
  const renderCup = () => {
    const r1g = data.crockGroups.filter((g) => g.game_id === game.id && g.stage === "r1");
    const r2g = data.crockGroups.filter((g) => g.game_id === game.id && g.stage === "r2");
    const finals = data.crockFinals.filter((f) => f.game_id === game.id);
    if (r1g.length === 0) return <MEmpty msg="Groups not set up yet" />;
    const GL: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D" };
    const sortG = (arr: typeof r1g) => [...arr].sort((a, b) => {
      if (a.time_seconds === null) return 1;
      if (b.time_seconds === null) return -1;
      return a.time_seconds - b.time_seconds;
    });
    return (<>
      {[1,2,3,4].map((gn) => {
        const members = sortG(r1g.filter((g) => g.group_number === gn));
        if (members.length === 0) return null;
        return (<div key={gn}>
          <MSec label={`R1 — Group ${GL[gn]}`} color={gn === 4 ? "text-amber-400" : "text-zinc-300"} />
          {members.map((g, i) => <MRow key={g.id} rank={g.time_seconds !== null ? i+1 : null}
            name={getName(g.contestant_id)} value={g.time_seconds !== null ? formatTime(g.time_seconds) : "–"}
            badge={g.time_seconds !== null && i < 2 ? "→R2" : undefined} badgeColor="text-green-400" />)}
        </div>);
      })}
      {r2g.length > 0 && [1,2].map((gn) => {
        const members = sortG(r2g.filter((g) => g.group_number === gn));
        if (members.length === 0) return null;
        return (<div key={gn}>
          <MSec label={`R2 — Group ${gn}`} color="text-blue-400" />
          {members.map((g, i) => <MRow key={g.id} rank={g.time_seconds !== null ? i+1 : null}
            name={getName(g.contestant_id)} value={g.time_seconds !== null ? formatTime(g.time_seconds) : "–"}
            badge={g.time_seconds !== null ? (i < 2 ? "→Final" : "→5-8") : undefined}
            badgeColor={i < 2 ? "text-green-400" : "text-zinc-500"} />)}
        </div>);
      })}
      {(["final","consol_r2","consol_r1"] as const).map((stage, si) => {
        const fs = finals.filter((f) => f.stage === stage && f.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
        if (fs.length === 0) return null;
        const baseRank = [1,5,9][si];
        const label = ["🏆 Final — 1st–4th", "5th–8th", "9th–11th"][si];
        const color = ["text-amber-400","text-zinc-400","text-zinc-500"][si];
        return (<div key={stage}>
          <MSec label={label} color={color} />
          {fs.map((f, i) => <MRow key={f.id} rank={baseRank+i} name={getName(f.contestant_id)} value={formatTime(f.time_seconds!)} top={stage === "final" && i === 0} />)}
        </div>);
      })}
    </>);
  };

  // ── Chessboard ──
  const renderChess = () => {
    const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
    const gameMatches = data.chessboardMatches.filter((m) => m.game_id === game.id);
    if (gamePlayers.length === 0) return <MEmpty msg="Teams not set up yet" />;
    const getTeamName = (t: number) => {
      const ms = gamePlayers.filter((p) => p.team_number === t);
      return ms.map((m) => getName(m.contestant_id)).join(" & ") || `Team ${t}`;
    };
    const activeTeams = new Set([1,2,3,4,5,6].filter((t) => gamePlayers.some((p) => p.team_number === t)));
    const ranksMap = computeChessboardTeamRanks(game.id, data.chessboardMatches);
    const pts = new Map<number,number>(), gf = new Map<number,number>(), ga = new Map<number,number>(), pl = new Map<number,number>();
    for (const t of activeTeams) { pts.set(t,0); gf.set(t,0); ga.set(t,0); pl.set(t,0); }
    for (const m of gameMatches.filter((m) => m.winner_team !== null)) {
      const sa = m.score_a??0, sb = m.score_b??0;
      gf.set(m.team_a,(gf.get(m.team_a)??0)+sa); ga.set(m.team_a,(ga.get(m.team_a)??0)+sb);
      gf.set(m.team_b,(gf.get(m.team_b)??0)+sb); ga.set(m.team_b,(ga.get(m.team_b)??0)+sa);
      pl.set(m.team_a,(pl.get(m.team_a)??0)+1); pl.set(m.team_b,(pl.get(m.team_b)??0)+1);
      if (m.winner_team===1) pts.set(m.team_a,(pts.get(m.team_a)??0)+3);
      else if (m.winner_team===2) pts.set(m.team_b,(pts.get(m.team_b)??0)+3);
      else { pts.set(m.team_a,(pts.get(m.team_a)??0)+1); pts.set(m.team_b,(pts.get(m.team_b)??0)+1); }
    }
    const played = gameMatches.filter((m) => m.winner_team !== null).length;
    const sorted = [...ranksMap.entries()].filter(([t]) => activeTeams.has(t)).sort((a,b) => a[1]-b[1]);
    return (<>
      <div className="px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800/40">{played}/{CHESS_PAIRS.length} matches played</div>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-zinc-800/50 text-zinc-500">
          <th className="px-4 py-2 text-left w-6">#</th>
          <th className="px-4 py-2 text-left">Team</th>
          <th className="px-3 py-2 text-center">Pts</th>
          <th className="px-3 py-2 text-center">GD</th>
          <th className="px-3 py-2 text-center">P</th>
        </tr></thead>
        <tbody>
          {sorted.map(([team, rank]) => {
            const gd = (gf.get(team)??0)-(ga.get(team)??0);
            return (<tr key={team} className={`border-b border-zinc-800/40 ${rank===1?"bg-amber-950/20":""}`}>
              <td className="px-4 py-2 font-bold text-amber-400">{rank}</td>
              <td className="px-4 py-2 text-zinc-200">{getTeamName(team)}</td>
              <td className="px-3 py-2 text-center font-bold text-zinc-200">{pts.get(team)??0}</td>
              <td className={`px-3 py-2 text-center ${gd>0?"text-green-400":gd<0?"text-red-400":"text-zinc-500"}`}>{gd>0?`+${gd}`:gd}</td>
              <td className="px-3 py-2 text-center text-zinc-500">{pl.get(team)??0}</td>
            </tr>);
          })}
        </tbody>
      </table>
      {played > 0 && (<>
        <div className="px-4 py-2 text-xs font-semibold text-zinc-400 border-t border-zinc-800/50 mt-1">Results</div>
        {CHESS_PAIRS.filter(([ta,tb]) => gameMatches.some((m)=>m.team_a===ta&&m.team_b===tb&&m.winner_team!==null)).map(([ta,tb]) => {
          const m = gameMatches.find((m)=>m.team_a===ta&&m.team_b===tb)!;
          return (<div key={`${ta}-${tb}`} className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-800/30 text-xs">
            <span className="flex-1 text-zinc-300">{getTeamName(ta)} vs {getTeamName(tb)}</span>
            <span className={`font-mono ${m.winner_team===0?"text-zinc-500":"text-amber-400"}`}>{m.score_a}–{m.score_b}</span>
          </div>);
        })}
      </>)}
    </>);
  };

  // ── Popp Koppen ──
  const renderPopp = () => {
    const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
    const gameRankings = data.teamRankings.filter((r) => r.game_id === game.id && r.rank !== null).sort((a,b) => a.rank!-b.rank!);
    if (gamePlayers.length === 0) return <MEmpty msg="Teams not set up yet" />;
    if (gameRankings.length === 0) return <MEmpty msg="Teams set — no results yet" />;
    const getTeamName = (t: number) => gamePlayers.filter((p) => p.team_number === t).map((m) => getName(m.contestant_id)).join(" & ") || `Team ${t}`;
    let pos = 1;
    return (<>
      {gameRankings.map((r) => {
        const members = gamePlayers.filter((p) => p.team_number === r.team_number);
        const startPos = pos; pos += members.length === 1 ? 1 : 2;
        return (<div key={r.team_number} className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30 ${startPos===1?"bg-amber-950/20":""}`}>
          <span className="text-xs font-bold text-amber-400 w-5 text-right shrink-0">{startPos}</span>
          <span className="flex-1 text-sm text-zinc-200">{getTeamName(r.team_number)}</span>
          {members.length === 1 && <span className="text-xs text-zinc-600">solo</span>}
        </div>);
      })}
    </>);
  };

  const content = (() => {
    if (game.game_type === "individual" || game.game_type === "individual_race") return renderIndividual();
    if (game.game_type === "individual_points") return renderPoints();
    if (game.game_type === "lives_bracket" || game.game_type === "lives_no_playoff") return renderLives();
    if (game.game_type === "cup_format") return renderCup();
    if (game.game_type === "team_chess") return renderChess();
    if (game.game_type === "team_popp") return renderPopp();
    return <MEmpty msg="No data" />;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-3 pb-3 pt-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl flex flex-col"
        style={{ maxHeight: "82vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
          <h2 className="font-bold text-amber-400 text-base">{game.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white h-8 w-8 flex items-center justify-center text-xl rounded-full hover:bg-zinc-800 shrink-0">×</button>
        </div>
        <div className="overflow-y-auto rounded-b-2xl">{content}</div>
      </div>
    </div>
  );
}

function LeaderboardPage() {
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState<BLGame | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["beerlympics"],
    queryFn: fetchAll,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const rows = data
    ? computeLeaderboard(
        data.contestants, data.games, data.round1, data.round2, data.bonuses,
        data.teamPlayers, data.teamRankings, data.chessboardMatches,
        data.livesStates, data.crockGroups, data.crockFinals,
      )
    : [];

  const hasAnyResult = (data?.round1.length ?? 0) > 0;
  const bracketGames = data?.games.filter(
    (g) => (g.game_type === "individual" || g.game_type === "individual_points") &&
           data.round1.filter((r) => r.game_id === g.id).length >= 6,
  ) ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍺</span>
            <span className="font-black tracking-tight text-amber-400 text-xl hidden sm:block">BEERLYMPICS</span>
            <span className="font-black tracking-tight text-amber-400 text-xl sm:hidden">BL</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/profile"
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                <span className="text-sm">👤</span>
                <span>{user.nickname ?? user.fullName.split(" ")[0]}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition-colors"
              >
                Login
              </Link>
            )}
            <Link
              to="/admin"
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-2 pb-12 pt-6">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-black tracking-tight text-amber-400">LEADERBOARD</h1>
          {hasAnyResult && (
            <p className="mt-1 text-xs text-zinc-600">Live · auto-refreshes every 15s · P = provisional</p>
          )}
        </div>

        {isLoading && (
          <div className="py-24 text-center text-zinc-600">
            <div className="text-4xl mb-3">🍺</div>
            Loading standings...
          </div>
        )}

        {error && (
          <div className="py-24 text-center text-red-400">
            Failed to connect to database. Check Supabase env vars.
          </div>
        )}

        {data && rows.length === 0 && (
          <div className="py-24 text-center text-zinc-600">
            <div className="text-4xl mb-3">🏆</div>
            <p>Leaderboard is empty. Run the database migration to get started.</p>
          </div>
        )}

        {data && rows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm" style={{ minWidth: "max-content" }}>
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    {/* Sticky rank column */}
                    <th className="sticky left-0 z-20 bg-zinc-900 w-10 px-2 py-3.5 text-center text-zinc-500 font-medium border-r border-zinc-800/50">#</th>
                    {/* Sticky player column */}
                    <th className="sticky left-10 z-20 bg-zinc-900 px-3 py-3.5 text-left text-zinc-300 font-semibold min-w-[110px] border-r border-zinc-800/50">Player</th>
                    {data.games.map((g) => (
                      <th key={g.id} className="px-2 py-3.5 text-center text-xs font-semibold text-zinc-400 whitespace-nowrap cursor-pointer hover:text-amber-400 transition-colors" title={g.name} onClick={() => setSelectedGame(g)}>
                        {SHORT[g.name] ?? g.name.substring(0, 4).toUpperCase()}
                      </th>
                    ))}
                    <th className="px-2 py-3.5 text-center text-xs font-semibold text-zinc-400">+/−</th>
                    <th className="px-3 py-3.5 text-center text-xs font-black text-amber-400 min-w-[52px]">TOT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const rowCls =
                      idx === 0 ? "bg-amber-950/20" :
                      idx === 1 ? "bg-zinc-800/10" :
                      idx === 2 ? "bg-orange-950/15" : "";
                    const stickyBg =
                      idx === 0 ? "bg-[#1a1007]" :
                      idx === 1 ? "bg-zinc-900/80" :
                      idx === 2 ? "bg-[#160e07]" : "bg-zinc-950";

                    return (
                      <tr key={row.contestant.id} className={`border-b border-zinc-800/40 ${rowCls}`}>
                        {/* Sticky rank */}
                        <td className={`sticky left-0 z-10 ${stickyBg} w-10 px-2 py-3 text-center border-r border-zinc-800/30`}>
                          <RankBadge rank={row.rank} />
                        </td>
                        {/* Sticky player */}
                        <td className={`sticky left-10 z-10 ${stickyBg} px-3 py-3 border-r border-zinc-800/30`}>
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={row.contestant.nickname ?? row.contestant.full_name}
                              photo_url={row.contestant.photo_url}
                            />
                            <span className="font-medium text-white whitespace-nowrap text-xs sm:text-sm">
                              {row.contestant.nickname ?? row.contestant.full_name.split(" ")[0]}
                            </span>
                          </div>
                        </td>
                        {data.games.map((g) => (
                          <GameCell key={g.id} row={row} gameId={g.id} />
                        ))}
                        <td className="px-2 py-3 text-center text-sm">
                          <span className={row.bonusTotal > 0 ? "font-semibold text-green-400" : row.bonusTotal < 0 ? "font-semibold text-red-400" : "text-zinc-700"}>
                            {row.bonusTotal > 0 ? `+${row.bonusTotal}` : row.bonusTotal < 0 ? row.bonusTotal : "–"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-base font-black text-amber-400 tabular-nums">{row.total}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Game status cards */}
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Games</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {data.games.map((g) => {
                  let statusLabel = "Upcoming";
                  let statusColor = "text-zinc-600";
                  let borderColor = "border-zinc-800";

                  if (g.game_type === "individual" || g.game_type === "individual_points") {
                    const r1c = data.round1.filter((r) => r.game_id === g.id).length;
                    const r2c = data.round2.filter((r) => r.game_id === g.id).length;
                    if (r2c >= 11) { statusLabel = "✓ Done"; statusColor = "text-green-400"; borderColor = "border-green-800"; }
                    else if (r2c > 0) { statusLabel = "Playoffs"; statusColor = "text-amber-400"; borderColor = "border-amber-800"; }
                    else if (r1c >= 11) { statusLabel = "R1 Done"; statusColor = "text-blue-400"; borderColor = "border-blue-800"; }
                    else if (r1c > 0) { statusLabel = `${r1c}/11`; statusColor = "text-yellow-400"; borderColor = "border-yellow-800"; }
                  } else if (g.game_type === "individual_race") {
                    const r1c = data.round1.filter((r) => r.game_id === g.id).length;
                    if (r1c >= 11) { statusLabel = "✓ Done"; statusColor = "text-green-400"; borderColor = "border-green-800"; }
                    else if (r1c > 0) { statusLabel = `${r1c}/11`; statusColor = "text-yellow-400"; borderColor = "border-yellow-800"; }
                  } else if (g.game_type === "lives_bracket") {
                    const lc = data.livesStates.filter((s) => s.game_id === g.id).length;
                    const elim = data.livesStates.filter((s) => s.game_id === g.id && s.eliminated_order !== null).length;
                    const r2c = data.round2.filter((r) => r.game_id === g.id).length;
                    if (r2c >= 6) { statusLabel = "✓ Done"; statusColor = "text-green-400"; borderColor = "border-green-800"; }
                    else if (r2c > 0) { statusLabel = "Playoffs"; statusColor = "text-amber-400"; borderColor = "border-amber-800"; }
                    else if (elim >= 5) { statusLabel = "Ready KO"; statusColor = "text-blue-400"; borderColor = "border-blue-800"; }
                    else if (lc > 0) { statusLabel = `${elim}/5 out`; statusColor = "text-yellow-400"; borderColor = "border-yellow-800"; }
                    else { statusLabel = "❤️ Lives"; }
                  } else if (g.game_type === "lives_no_playoff") {
                    const lc = data.livesStates.filter((s) => s.game_id === g.id).length;
                    const elim = data.livesStates.filter((s) => s.game_id === g.id && s.eliminated_order !== null).length;
                    if (elim >= 5) { statusLabel = "✓ Done"; statusColor = "text-green-400"; borderColor = "border-green-800"; }
                    else if (lc > 0) { statusLabel = `${elim}/5 out`; statusColor = "text-yellow-400"; borderColor = "border-yellow-800"; }
                    else { statusLabel = "❤️ Lives"; }
                  } else if (g.game_type === "cup_format") {
                    const gc = data.crockGroups.filter((g2) => g2.game_id === g.id).length;
                    const r2c = data.round2.filter((r) => r.game_id === g.id).length;
                    if (r2c >= 9) { statusLabel = "✓ Done"; statusColor = "text-green-400"; borderColor = "border-green-800"; }
                    else if (r2c > 0) { statusLabel = "Knockout"; statusColor = "text-amber-400"; borderColor = "border-amber-800"; }
                    else if (gc >= 11) { statusLabel = "Groups set"; statusColor = "text-blue-400"; borderColor = "border-blue-800"; }
                    else if (gc > 0) { statusLabel = `${gc}/11 set`; statusColor = "text-yellow-400"; borderColor = "border-yellow-800"; }
                    else { statusLabel = "🏆 Cup"; }
                  } else {
                    const tp = data.teamPlayers.filter((p) => p.game_id === g.id).length;
                    const tr = data.teamRankings.filter((r) => r.game_id === g.id && r.tiebreak_winner_id).length;
                    const matches = g.game_type === "team_chess"
                      ? data.chessboardMatches.filter((m) => m.game_id === g.id && m.winner_team !== null).length : 0;
                    if (tr === 5) { statusLabel = "✓ Done"; statusColor = "text-green-400"; borderColor = "border-green-800"; }
                    else if (g.game_type === "team_chess" && matches > 0) { statusLabel = `League ${matches}/10`; statusColor = "text-amber-400"; borderColor = "border-amber-800"; }
                    else if (g.game_type === "team_popp" && data.teamRankings.filter((r) => r.game_id === g.id && r.rank !== null).length > 0) {
                      statusLabel = "Results in"; statusColor = "text-amber-400"; borderColor = "border-amber-800";
                    } else if (tp > 0) { statusLabel = "Teams set"; statusColor = "text-blue-400"; borderColor = "border-blue-800"; }
                    else { statusLabel = g.game_type === "team_chess" ? "♟️ League" : "👥 Team"; }
                  }

                  return (
                    <button key={g.id} onClick={() => setSelectedGame(g)} className={`rounded-lg border px-3 py-2 text-center w-full transition-colors hover:border-zinc-600 hover:bg-zinc-900/60 active:bg-zinc-800/60 ${borderColor}`}>
                      <div className="text-xs font-semibold text-zinc-300 truncate">{g.name}</div>
                      <div className={`mt-0.5 text-[10px] ${statusColor}`}>{statusLabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bracket cards */}
            {bracketGames.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Playoff Brackets</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {bracketGames.map((g) => (
                    <BracketCard key={g.id} game={g} data={data} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {selectedGame && data && (
        <GameProgressModal
          game={selectedGame}
          data={data}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
