import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchAll,
  type FetchAllResult,
  upsertRound1,
  upsertRound2,
  deleteRound1,
  deleteRound2,
  addBonus,
  deleteBonus,
  saveTeamAssignments,
  upsertTeamRanking,
  upsertChessboardMatch,
  upsertLivesState,
  resetLivesGame,
  upsertCrockGroup,
  saveCrockAssignments,
} from "@/lib/api";
import {
  parseTime,
  formatTime,
  getBrackets,
  getLivesBrackets,
  computeLeaderboard,
  computeChessboardTeamRanks,
  CHESS_PAIRS,
} from "@/lib/scoring";
import type { Contestant, BLGame, BonusPoint, TeamGamePlayer, LivesGameState } from "@/lib/types";

const ADMIN_PASSWORD = "beerlympics2024";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("bl-admin") === "1");
  const [pw, setPw] = useState("");

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <span className="text-4xl">🔒</span>
            <h1 className="mt-2 text-xl font-black text-amber-400">Admin</h1>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pw === ADMIN_PASSWORD) {
                sessionStorage.setItem("bl-admin", "1");
                setAuthed(true);
              }
            }}
            placeholder="Password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => {
              if (pw === ADMIN_PASSWORD) {
                sessionStorage.setItem("bl-admin", "1");
                setAuthed(true);
              } else {
                toast.error("Wrong password");
              }
            }}
            className="mt-3 w-full rounded-lg bg-amber-500 py-3 font-semibold text-black hover:bg-amber-400"
          >
            Enter
          </button>
          <Link to="/" className="mt-4 block text-center text-xs text-zinc-600 hover:text-zinc-400">
            ← Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  return <AdminPanel onLogout={() => { sessionStorage.removeItem("bl-admin"); setAuthed(false); }} />;
}

// ──────────────────────────────────────────────────────────────
// Admin panel shell
// ──────────────────────────────────────────────────────────────

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"times" | "bonus" | "contestants">("times");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["beerlympics"], queryFn: fetchAll, staleTime: 0 });

  if (isLoading || !data) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>;
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["beerlympics"] });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 text-sm">← Leaderboard</Link>
          <span className="text-zinc-700">|</span>
          <span className="font-bold text-amber-400">Admin</span>
        </div>
        <button onClick={onLogout} className="text-xs text-zinc-600 hover:text-zinc-400">Logout</button>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex gap-2">
          {([["times", "⏱ Times"], ["bonus", "⭐ Bonus"], ["contestants", "👥 PINs"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors touch-manipulation ${tab === key ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "times" && <TimesTab data={data} onMutate={invalidate} />}
        {tab === "bonus" && <BonusTab contestants={data.contestants} bonuses={data.bonuses} onMutate={invalidate} />}
        {tab === "contestants" && <ContestantsTab contestants={data.contestants} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Times tab — routes to correct panel per game type
// ──────────────────────────────────────────────────────────────

function TimesTab({ data, onMutate }: { data: FetchAllResult; onMutate: () => void }) {
  const [gameId, setGameId] = useState(data.games[0]?.id ?? "");
  const game = data.games.find((g) => g.id === gameId);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm text-zinc-400 whitespace-nowrap">Game:</label>
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none">
          {data.games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} {g.game_type !== "individual" ? (g.game_type === "team_popp" ? "👥" : "♟️") : ""}
            </option>
          ))}
        </select>
        {game && game.game_type !== "individual" && (
          <span className="text-xs text-amber-500 font-semibold">TEAM GAME</span>
        )}
      </div>

      {(game?.game_type === "individual" || game?.game_type === "individual_points") && (
        <IndividualTimesPanel game={game} data={data} onMutate={onMutate} isPoints={game.game_type === "individual_points"} />
      )}
      {game?.game_type === "lives_bracket" && (
        <LivesPanel game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "cup_format" && (
        <CupFormatPanel game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "team_popp" && (
        <PoppKoppenPanel game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "team_chess" && (
        <ChessboardPanel game={game} data={data} onMutate={onMutate} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Individual game time entry
// ──────────────────────────────────────────────────────────────

function IndividualTimesPanel({ game, data, onMutate, isPoints = false }: { game: BLGame; data: FetchAllResult; onMutate: () => void; isPoints?: boolean }) {
  const r1ForGame = data.round1.filter((r) => r.game_id === game.id);
  const r2ForGame = data.round2.filter((r) => r.game_id === game.id);
  const { bracketA, bracketB } = getBrackets(game.id, data.round1);
  const hasBrackets = bracketA.length >= 6;

  return (
    <>
      <div className="mb-5 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800">
          <h3 className="font-semibold text-zinc-200">
            {isPoints ? "Points — All contestants" : "Round 1 — All contestants"}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isPoints ? "Enter points scored (e.g. 7)" : "Seconds (e.g. 45.32) or mm:ss (e.g. 1:23.45)"}
          </p>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {data.contestants.map((c) => (
            <TimeRow key={c.id} contestant={c} gameId={game.id} round="r1"
              existing={r1ForGame.find((r) => r.contestant_id === c.id)?.time_seconds ?? null}
              bracket={hasBrackets ? (bracketA.includes(c.id) ? "A" : "B") : null}
              isPoints={isPoints}
              onSave={async (secs) => {
                const { error } = await upsertRound1(c.id, game.id, secs);
                if (error) { toast.error("Save failed"); return; }
                toast.success(`R1 saved — ${c.nickname ?? c.full_name.split(" ")[0]}`);
                onMutate();
              }}
              onDelete={async () => { await deleteRound1(c.id, game.id); onMutate(); }}
            />
          ))}
        </div>
      </div>

      {hasBrackets && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800">
            <h3 className="font-semibold text-zinc-200">Round 2 — Playoffs</h3>
            <p className="text-xs text-zinc-500 mt-0.5">A bracket → positions 1–6 · B bracket → positions 7–11</p>
          </div>
          <div className="p-4 grid gap-4 sm:grid-cols-2">
            {[{ ids: bracketA, label: "🏆 Bracket A (Top 6)", color: "text-green-400" },
              { ids: bracketB, label: "Bracket B (Bottom 5)", color: "text-zinc-400" }].map(({ ids, label, color }) => (
              <div key={label}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</div>
                <div className="space-y-0.5">
                  {ids.map((cid) => {
                    const c = data.contestants.find((x) => x.id === cid)!;
                    return (
                      <TimeRow key={cid} contestant={c} gameId={game.id} round="r2"
                        existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                        bracket={ids === bracketA ? "A" : "B"}
                        isPoints={isPoints}
                        onSave={async (secs) => {
                          const { error } = await upsertRound2(c.id, game.id, secs);
                          if (error) { toast.error("Save failed"); return; }
                          toast.success(`R2 saved — ${c.nickname ?? c.full_name.split(" ")[0]}`);
                          onMutate();
                        }}
                        onDelete={async () => { await deleteRound2(c.id, game.id); onMutate(); }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasBrackets && (
        <p className="text-xs text-zinc-600 text-center py-3">
          Enter all 11 Round 1 times to unlock playoff brackets
        </p>
      )}
    </>
  );
}

function TimeRow({ contestant, gameId, round, existing, bracket, isPoints = false, onSave, onDelete }: {
  contestant: Contestant; gameId: string; round: "r1" | "r2"; existing: number | null;
  bracket: "A" | "B" | null; isPoints?: boolean; onSave: (s: number) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const displayVal = (v: number) => isPoints ? v.toString() : formatTime(v);
  const [val, setVal] = useState(existing !== null ? displayVal(existing) : "");
  const [saving, setSaving] = useState(false);
  const name = contestant.nickname ?? contestant.full_name.split(" ")[0];
  const isDirty = val !== (existing !== null ? displayVal(existing) : "");

  async function handleSave() {
    if (isPoints) {
      const pts = parseFloat(val.trim());
      if (isNaN(pts) || pts < 0) { toast.error("Enter a valid score"); return; }
      setSaving(true);
      await onSave(pts);
      setSaving(false);
      return;
    }
    const secs = parseTime(val);
    if (!secs || secs <= 0) { toast.error("Invalid time"); return; }
    setSaving(true);
    await onSave(secs);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/20">
      {bracket && (
        <span className={`text-xs font-bold w-4 shrink-0 ${bracket === "A" ? "text-green-400" : "text-zinc-500"}`}>{bracket}</span>
      )}
      <span className="w-24 text-sm text-zinc-300 truncate shrink-0">{name}</span>
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        placeholder={isPoints ? "e.g. 7" : "e.g. 45.32"} inputMode="decimal"
        className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none tabular-nums" />
      {isDirty && val && (
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {saving ? "…" : "Save"}
        </button>
      )}
      {!isDirty && existing !== null && (
        <button onClick={async () => { await onDelete(); setVal(""); }}
          className="rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-500 hover:text-red-400 shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>×</button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Shared: Teams setup (used by both Popp Koppen and Chessboard)
// ──────────────────────────────────────────────────────────────

function TeamsSetup({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  // Compute current standings to determine team pairs
  const leaderboard = computeLeaderboard(
    data.contestants, data.games, data.round1, data.round2, data.bonuses,
    data.teamPlayers, data.teamRankings, data.chessboardMatches,
  );

  const ranked = leaderboard.map((r) => r.contestant);
  const existingPlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const hasTeams = existingPlayers.length > 0;

  // Suggested pairings based on standings
  const pairs: [Contestant, Contestant][] = [
    [ranked[0], ranked[9]],
    [ranked[1], ranked[8]],
    [ranked[2], ranked[7]],
    [ranked[3], ranked[6]],
    [ranked[4], ranked[5]],
  ];
  const eleventh = ranked[10];

  const [eleventhTeam, setEleventhTeam] = useState<number>(1);
  const [eleventhPlaysWith, setEleventhPlaysWith] = useState<string>(pairs[0]?.[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const chosenPair = pairs[eleventhTeam - 1];
  const displacedId = chosenPair?.find((c) => c.id !== eleventhPlaysWith)?.id ?? null;
  const displacedName = data.contestants.find((c) => c.id === displacedId);

  async function handleSave() {
    if (!eleventh) { toast.error("Not enough contestants"); return; }
    setSaving(true);

    const assignments: { contestantId: string; teamNumber: number; isDisplaced: boolean }[] = [];
    for (let i = 0; i < 5; i++) {
      const [a, b] = pairs[i];
      const teamNum = i + 1;
      if (teamNum === eleventhTeam) {
        // This team gets #11
        assignments.push({ contestantId: eleventh.id, teamNumber: teamNum, isDisplaced: false });
        // The chosen partner stays in
        assignments.push({ contestantId: eleventhPlaysWith, teamNumber: teamNum, isDisplaced: false });
        // The displaced one
        const dispId = [a, b].find((c) => c.id !== eleventhPlaysWith)!.id;
        assignments.push({ contestantId: dispId, teamNumber: teamNum, isDisplaced: true });
      } else {
        assignments.push({ contestantId: a.id, teamNumber: teamNum, isDisplaced: false });
        assignments.push({ contestantId: b.id, teamNumber: teamNum, isDisplaced: false });
      }
    }

    const { error } = await saveTeamAssignments(game.id, assignments);
    setSaving(false);
    if (error) { toast.error("Save failed: " + (error as any).message); return; }
    toast.success("Teams saved!");
    onMutate();
  }

  const getName = (c: Contestant) => c.nickname ?? c.full_name.split(" ")[0];

  return (
    <div>
      {/* Current standings context */}
      <div className="mb-4 rounded-lg border border-zinc-800 p-3">
        <p className="text-xs font-semibold text-zinc-400 mb-2">Current standings (used for team formation)</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
          {leaderboard.slice(0, 11).map((r) => (
            <div key={r.contestant.id}>
              #{r.rank} {getName(r.contestant)} <span className="text-zinc-600">({r.total}pts)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested pairs */}
      <div className="mb-4 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-300">Auto-suggested teams (#1+#10, #2+#9, etc.)</span>
        </div>
        <div className="divide-y divide-zinc-800/40">
          {pairs.map(([a, b], i) => {
            const existing = existingPlayers.filter((p) => p.team_number === i + 1);
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="w-16 text-xs font-semibold text-amber-500">Team {i + 1}</span>
                <span className="text-sm text-zinc-300">{getName(a)}</span>
                <span className="text-zinc-600">+</span>
                <span className="text-sm text-zinc-300">{getName(b)}</span>
                {i + 1 === eleventhTeam && (
                  <span className="text-xs text-amber-500 ml-auto">← #{11} joins here</span>
                )}
              </div>
            );
          })}
          {eleventh && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/20">
              <span className="w-16 text-xs font-semibold text-zinc-500">#11</span>
              <span className="text-sm font-semibold text-amber-400">{getName(eleventh)}</span>
              <span className="text-xs text-zinc-500">picks their team →</span>
            </div>
          )}
        </div>
      </div>

      {/* #11 assignment */}
      {eleventh && (
        <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <p className="text-sm font-semibold text-amber-300 mb-3">
            {getName(eleventh)} (#{11}) joins which team?
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {pairs.map(([a, b], i) => (
              <button key={i}
                onClick={() => { setEleventhTeam(i + 1); setEleventhPlaysWith(a.id); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${eleventhTeam === i + 1 ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                Team {i + 1}: {getName(a)} + {getName(b)}
              </button>
            ))}
          </div>
          {chosenPair && (
            <>
              <p className="text-xs text-zinc-400 mb-2">
                {getName(eleventh)} plays WITH:
              </p>
              <div className="flex gap-2 mb-3">
                {chosenPair.map((c) => (
                  <button key={c.id}
                    onClick={() => setEleventhPlaysWith(c.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${eleventhPlaysWith === c.id ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                    {getName(c)}
                  </button>
                ))}
              </div>
              {displacedName && (
                <p className="text-xs text-zinc-500">
                  Displaced (1 point): <span className="text-orange-400 font-semibold">{getName(displacedName)}</span>
                </p>
              )}
            </>
          )}
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !eleventh}
        className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-black hover:bg-amber-400 disabled:opacity-40">
        {saving ? "Saving…" : hasTeams ? "Update Teams" : "Save Teams"}
      </button>

      {hasTeams && (
        <div className="mt-4 rounded-lg border border-zinc-800 p-3">
          <p className="text-xs font-semibold text-zinc-400 mb-2">Current team assignments</p>
          <div className="grid gap-1 text-xs text-zinc-400">
            {[1, 2, 3, 4, 5].map((t) => {
              const members = existingPlayers.filter((p) => p.team_number === t);
              return (
                <div key={t} className="flex gap-2">
                  <span className="font-semibold text-amber-500 w-14">Team {t}</span>
                  {members.map((p) => {
                    const c = data.contestants.find((x) => x.id === p.contestant_id);
                    return c ? (
                      <span key={p.id} className={p.is_displaced ? "text-zinc-600 line-through" : "text-zinc-300"}>
                        {getName(c)}{p.is_displaced ? " (out)" : ""}
                      </span>
                    ) : null;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Shared: Tiebreakers (within-team 1v1 after team result known)
// ──────────────────────────────────────────────────────────────

function TiebreakersSetup({ game, data, ranks, onMutate }: {
  game: BLGame;
  data: FetchAllResult;
  ranks: Map<number, number>; // team_number → rank (1-5)
  onMutate: () => void;
}) {
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const gameRankings = data.teamRankings.filter((r) => r.game_id === game.id);
  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  if (gamePlayers.length === 0) {
    return <p className="text-sm text-zinc-600 py-4 text-center">Set teams first</p>;
  }
  if (ranks.size === 0) {
    return <p className="text-sm text-zinc-600 py-4 text-center">Enter game results first</p>;
  }

  const sortedTeams = [...ranks.entries()].sort((a, b) => a[1] - b[1]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">Pick who wins the within-team 1v1 for the extra point.</p>
      {sortedTeams.map(([teamNum, rank]) => {
        const members = gamePlayers.filter((p) => p.team_number === teamNum && !p.is_displaced);
        if (members.length < 2) return null;
        const existing = gameRankings.find((r) => r.team_number === teamNum);
        const highPts = 13 - 2 * rank;
        const lowPts  = 12 - 2 * rank;

        return (
          <div key={teamNum} className={`rounded-xl border p-4 ${existing?.tiebreak_winner_id ? "border-green-800 bg-green-950/20" : "border-zinc-800"}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-amber-500">Team {teamNum}</span>
              <span className="text-xs text-zinc-400">→ {rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : rank === 4 ? "4th" : "5th"} place</span>
              <span className="text-xs text-zinc-500 ml-auto">Winner: {highPts}pts · Loser: {lowPts}pts</span>
            </div>
            <div className="flex gap-3">
              {members.map((p) => {
                const isWinner = existing?.tiebreak_winner_id === p.contestant_id;
                return (
                  <button key={p.id}
                    onClick={async () => {
                      const { error } = await upsertTeamRanking(game.id, teamNum, rank, p.contestant_id);
                      if (error) { toast.error("Save failed"); return; }
                      toast.success(`${getName(p.contestant_id)} wins Team ${teamNum} tiebreaker!`);
                      onMutate();
                    }}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${isWinner ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                    {isWinner ? "✓ " : ""}{getName(p.contestant_id)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Popp Koppen panel
// ──────────────────────────────────────────────────────────────

function PoppKoppenPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const [subTab, setSubTab] = useState<"teams" | "rankings" | "tiebreakers">("teams");
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const gameRankings = data.teamRankings.filter((r) => r.game_id === game.id && r.rank !== null);

  // Build ranks map from stored rankings
  const ranksMap = new Map<number, number>(gameRankings.map((r) => [r.team_number, r.rank!]));

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {([["teams", "👥 Teams"], ["rankings", "🏆 Rankings"], ["tiebreakers", "⚡ Tiebreakers"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${subTab === key ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === "teams" && <TeamsSetup game={game} data={data} onMutate={onMutate} />}
      {subTab === "rankings" && <PoppKoppenRankings game={game} data={data} onMutate={onMutate} />}
      {subTab === "tiebreakers" && <TiebreakersSetup game={game} data={data} ranks={ranksMap} onMutate={onMutate} />}
    </div>
  );
}

function PoppKoppenRankings({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const gameRankings = data.teamRankings.filter((r) => r.game_id === game.id);

  const [rankDraft, setRankDraft] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const r of gameRankings) {
      if (r.rank !== null) init[r.team_number] = r.rank.toString();
    }
    return init;
  });

  if (gamePlayers.length === 0) {
    return <p className="text-sm text-zinc-600 py-4 text-center">Set teams first</p>;
  }

  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };
  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th"];

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 mb-3">Assign a finishing rank to each team after they complete Popp Koppen.</p>
      {[1, 2, 3, 4, 5].map((teamNum) => {
        const members = gamePlayers.filter((p) => p.team_number === teamNum && !p.is_displaced);
        const existing = gameRankings.find((r) => r.team_number === teamNum);
        const rank = rankDraft[teamNum] ?? "";

        return (
          <div key={teamNum} className="rounded-lg border border-zinc-800 px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-amber-500">Team {teamNum}</span>
              <span className="text-sm text-zinc-300">{members.map((m) => getName(m.contestant_id)).join(" + ")}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={rank}
                onChange={(e) => setRankDraft((prev) => ({ ...prev, [teamNum]: e.target.value }))}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none touch-manipulation">
                <option value="">— rank —</option>
                {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r.toString()}>{ORDINALS[r]}</option>)}
              </select>
              <button
                onClick={async () => {
                  const r = parseInt(rank, 10);
                  if (isNaN(r)) { toast.error("Pick a rank"); return; }
                  const { error } = await upsertTeamRanking(game.id, teamNum, r, existing?.tiebreak_winner_id ?? null);
                  if (error) { toast.error("Save failed"); return; }
                  toast.success(`Team ${teamNum} → ${ORDINALS[r]}`);
                  onMutate();
                }}
                className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Save
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Chessboard panel
// ──────────────────────────────────────────────────────────────

function ChessboardPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const [subTab, setSubTab] = useState<"teams" | "league" | "tiebreakers">("teams");
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const ranksMap = computeChessboardTeamRanks(game.id, data.chessboardMatches);

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {([["teams", "👥 Teams"], ["league", "♟️ League"], ["tiebreakers", "⚡ Tiebreakers"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${subTab === key ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === "teams" && <TeamsSetup game={game} data={data} onMutate={onMutate} />}
      {subTab === "league" && <ChessboardLeague game={game} data={data} onMutate={onMutate} />}
      {subTab === "tiebreakers" && <TiebreakersSetup game={game} data={data} ranks={ranksMap} onMutate={onMutate} />}
    </div>
  );
}

function ChessboardLeague({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const matches = data.chessboardMatches.filter((m) => m.game_id === game.id);

  if (gamePlayers.length === 0) {
    return <p className="text-sm text-zinc-600 py-4 text-center">Set teams first</p>;
  }

  const getTeamMembers = (teamNum: number) =>
    gamePlayers.filter((p) => p.team_number === teamNum && !p.is_displaced);
  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  // League standings with points + goal diff
  const ranksMap = computeChessboardTeamRanks(game.id, data.chessboardMatches);
  const pts = new Map([1, 2, 3, 4, 5].map((t) => [t, 0]));
  const gf  = new Map([1, 2, 3, 4, 5].map((t) => [t, 0]));
  const ga  = new Map([1, 2, 3, 4, 5].map((t) => [t, 0]));
  for (const m of matches.filter((m) => m.winner_team !== null)) {
    const sa = m.score_a ?? 0, sb = m.score_b ?? 0;
    gf.set(m.team_a, (gf.get(m.team_a) ?? 0) + sa);
    ga.set(m.team_a, (ga.get(m.team_a) ?? 0) + sb);
    gf.set(m.team_b, (gf.get(m.team_b) ?? 0) + sb);
    ga.set(m.team_b, (ga.get(m.team_b) ?? 0) + sa);
    if (m.winner_team === 1) pts.set(m.team_a, (pts.get(m.team_a) ?? 0) + 3);
    else if (m.winner_team === 2) pts.set(m.team_b, (pts.get(m.team_b) ?? 0) + 3);
    else if (m.winner_team === 0) { pts.set(m.team_a, (pts.get(m.team_a) ?? 0) + 1); pts.set(m.team_b, (pts.get(m.team_b) ?? 0) + 1); }
  }
  const played = matches.filter((m) => m.winner_team !== null).length;

  return (
    <div>
      {/* Standings */}
      {played > 0 && (
        <div className="mb-5 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-300">League standings ({played}/10 played)</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-center">Pts</th>
                <th className="px-3 py-2 text-center">GD</th>
              </tr>
            </thead>
            <tbody>
              {[...ranksMap.entries()].sort((a, b) => a[1] - b[1]).map(([team, rank]) => {
                const members = getTeamMembers(team);
                const gd = (gf.get(team) ?? 0) - (ga.get(team) ?? 0);
                return (
                  <tr key={team} className="border-b border-zinc-800/40">
                    <td className="px-3 py-2 font-bold text-amber-400">{rank}</td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      T{team}: {members.map((m) => getName(m.contestant_id)).join("+")}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-zinc-200">{pts.get(team) ?? 0}</td>
                    <td className={`px-3 py-2 text-center ${gd > 0 ? "text-green-400" : gd < 0 ? "text-red-400" : "text-zinc-500"}`}>{gd > 0 ? `+${gd}` : gd}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Matches */}
      <div className="space-y-2">
        {CHESS_PAIRS.map(([ta, tb]) => {
          const existing = matches.find((m) => m.team_a === ta && m.team_b === tb);
          const aMembers = getTeamMembers(ta);
          const bMembers = getTeamMembers(tb);

          return (
            <ChessMatchRow key={`${ta}-${tb}`}
              gameId={game.id} teamA={ta} teamB={tb}
              aMembers={aMembers} bMembers={bMembers}
              existing={existing ?? null}
              getName={getName}
              onSave={async (playerAId, playerBId, scoreA, scoreB) => {
                const { error } = await upsertChessboardMatch(game.id, ta, tb, playerAId, playerBId, scoreA, scoreB);
                if (error) { toast.error("Save failed"); return; }
                toast.success(`Team ${ta} vs Team ${tb} — result saved`);
                onMutate();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChessMatchRow({ gameId, teamA, teamB, aMembers, bMembers, existing, getName, onSave }: {
  gameId: string; teamA: number; teamB: number;
  aMembers: TeamGamePlayer[]; bMembers: TeamGamePlayer[];
  existing: { player_a_id: string | null; player_b_id: string | null; winner_team: number | null; score_a: number | null; score_b: number | null } | null;
  getName: (id: string) => string;
  onSave: (pa: string | null, pb: string | null, sa: number | null, sb: number | null) => Promise<void>;
}) {
  const [playerA, setPlayerA] = useState<string>(existing?.player_a_id ?? aMembers[0]?.contestant_id ?? "");
  const [playerB, setPlayerB] = useState<string>(existing?.player_b_id ?? bMembers[0]?.contestant_id ?? "");
  const [scoreA, setScoreA] = useState<string>(existing?.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState<string>(existing?.score_b?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const done = existing?.winner_team !== null && existing?.winner_team !== undefined;

  const sa = parseInt(scoreA, 10), sb = parseInt(scoreB, 10);
  const canSave = !isNaN(sa) && !isNaN(sb);
  const resultLabel = canSave
    ? sa > sb ? `T${teamA} wins` : sb > sa ? `T${teamB} wins` : "Draw"
    : null;

  return (
    <div className={`rounded-lg border px-4 py-3 ${done ? "border-green-800 bg-green-950/10" : "border-zinc-800"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-400">Team {teamA} vs Team {teamB}</span>
        {done && <span className="text-xs text-green-400">✓ {existing?.score_a ?? ""}–{existing?.score_b ?? ""}</span>}
      </div>
      {/* Player selects */}
      <div className="flex items-center gap-2 mb-3">
        <select value={playerA} onChange={(e) => setPlayerA(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none touch-manipulation">
          {aMembers.map((m) => <option key={m.contestant_id} value={m.contestant_id}>{getName(m.contestant_id)} (T{teamA})</option>)}
        </select>
        <span className="text-zinc-600 text-xs shrink-0">vs</span>
        <select value={playerB} onChange={(e) => setPlayerB(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none touch-manipulation">
          {bMembers.map((m) => <option key={m.contestant_id} value={m.contestant_id}>{getName(m.contestant_id)} (T{teamB})</option>)}
        </select>
      </div>
      {/* Score entry */}
      <div className="flex items-center gap-2">
        <input value={scoreA} onChange={(e) => setScoreA(e.target.value)} placeholder="0"
          inputMode="numeric" className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-center text-lg font-bold text-white focus:border-amber-500 focus:outline-none" />
        <span className="text-zinc-500 font-bold shrink-0">–</span>
        <input value={scoreB} onChange={(e) => setScoreB(e.target.value)} placeholder="0"
          inputMode="numeric" className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-center text-lg font-bold text-white focus:border-amber-500 focus:outline-none" />
        <button
          onClick={async () => {
            if (!canSave) { toast.error("Enter both scores"); return; }
            setSaving(true);
            await onSave(playerA || null, playerB || null, sa, sb);
            setSaving(false);
          }}
          disabled={saving || !canSave}
          className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-40 touch-manipulation shrink-0"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {saving ? "…" : "Save"}
        </button>
      </div>
      {resultLabel && <p className="mt-2 text-center text-xs text-zinc-500">{resultLabel}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Lives panel (Foot Tennis, Slap Cup)
// ──────────────────────────────────────────────────────────────

function LivesPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const [subTab, setSubTab] = useState<"lives" | "playoffs">("lives");
  const states = data.livesStates.filter((s) => s.game_id === game.id);
  const { bracketA } = getLivesBrackets(game.id, data.livesStates);
  const r2ForGame = data.round2.filter((r) => r.game_id === game.id);

  const eliminated = states.filter((s) => s.eliminated_order !== null).sort((a, b) => a.eliminated_order! - b.eliminated_order!);
  const nextElimOrder = eliminated.length + 1;

  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  async function handleInit() {
    await resetLivesGame(game.id);
    await Promise.all(
      data.contestants.map((c) =>
        upsertLivesState(game.id, c.id, 3, 3, null)
      )
    );
    toast.success("Lives game started — all players at 3 lives");
    onMutate();
  }

  async function handleRemoveLife(state: LivesGameState) {
    const newLives = state.current_lives - 1;
    const elimOrder = newLives <= 0 ? nextElimOrder : null;
    if (newLives <= 0 && !state.eliminated_order) {
      toast.success(`${getName(state.contestant_id)} eliminated! Position ${12 - nextElimOrder}`);
    }
    await upsertLivesState(game.id, state.contestant_id, state.initial_lives, Math.max(0, newLives), elimOrder ?? state.eliminated_order ?? null);
    onMutate();
  }

  async function handleAddLife(state: LivesGameState) {
    if (state.eliminated_order !== null) return; // can't restore eliminated
    await upsertLivesState(game.id, state.contestant_id, state.initial_lives, state.current_lives + 1, null);
    onMutate();
  }

  if (states.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 p-8 text-center">
        <p className="text-zinc-400 mb-4 text-sm">Start the lives tracking for {game.name}</p>
        <button onClick={handleInit}
          className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400 touch-manipulation">
          Start — 3 lives each
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(["lives", "playoffs"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors touch-manipulation ${subTab === t ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {t === "lives" ? "❤️ Lives" : "🏆 Playoffs (Top 6)"}
          </button>
        ))}
        <button onClick={() => { if (confirm("Reset lives game?")) handleInit(); }}
          className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-600 hover:text-red-400 touch-manipulation shrink-0">
          Reset
        </button>
      </div>

      {subTab === "lives" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 mb-3">
            {eliminated.length}/5 eliminated · {5 - eliminated.length} more until playoffs
          </p>
          {[...states]
            .sort((a, b) => {
              if (a.eliminated_order !== null && b.eliminated_order !== null) return a.eliminated_order - b.eliminated_order;
              if (a.eliminated_order !== null) return 1;
              if (b.eliminated_order !== null) return -1;
              return b.current_lives - a.current_lives;
            })
            .map((s) => {
              const isOut = s.eliminated_order !== null;
              const pos = isOut ? 12 - s.eliminated_order! : null;
              return (
                <div key={s.id} className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${isOut ? "border-zinc-800 bg-zinc-900/30 opacity-60" : "border-zinc-700"}`}>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">{getName(s.contestant_id)}</span>
                    {isOut && <span className="ml-2 text-xs text-zinc-500">Position {pos}</span>}
                  </div>
                  {/* Life dots */}
                  <div className="flex gap-1.5 items-center">
                    {Array.from({ length: s.initial_lives }).map((_, i) => (
                      <div key={i} className={`h-4 w-4 rounded-full ${i < s.current_lives ? "bg-red-500" : "bg-zinc-700"}`} />
                    ))}
                  </div>
                  {!isOut && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAddLife(s)}
                        className="h-9 w-9 rounded-lg border border-zinc-700 text-zinc-400 hover:text-green-400 font-bold touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>+</button>
                      <button
                        onClick={() => handleRemoveLife(s)}
                        className={`h-9 w-9 rounded-lg font-bold touch-manipulation ${s.current_lives <= 1 ? "bg-red-600 text-white hover:bg-red-500" : "border border-zinc-700 text-zinc-400 hover:text-red-400"}`}
                        style={{ WebkitTapHighlightColor: "transparent" }}>−</button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {subTab === "playoffs" && (
        <>
          {bracketA.length < 6 ? (
            <p className="text-xs text-zinc-600 text-center py-4">Eliminate 5 players first to unlock playoffs</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 mb-3">Enter playoff times for the 6 survivors (lower = better)</p>
              {bracketA.map((cid) => {
                const c = data.contestants.find((x) => x.id === cid)!;
                if (!c) return null;
                return (
                  <TimeRow key={cid} contestant={c} gameId={game.id} round="r2"
                    existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                    bracket="A"
                    onSave={async (secs) => {
                      const { error } = await upsertRound2(c.id, game.id, secs);
                      if (error) { toast.error("Save failed"); return; }
                      toast.success(`Saved — ${c.nickname ?? c.full_name.split(" ")[0]}`);
                      onMutate();
                    }}
                    onDelete={async () => { await deleteRound2(c.id, game.id); onMutate(); }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Cup format panel (Crock it)
// ──────────────────────────────────────────────────────────────

const CROCK_GROUP_LABELS: Record<number, string> = { 1: "Group A", 2: "Group B", 3: "Group C", 4: "Group D", 5: "Wildcard" };

function CupFormatPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const [subTab, setSubTab] = useState<"groups" | "knockout">("groups");
  const gameGroups = data.crockGroups.filter((g) => g.game_id === game.id);
  const r2ForGame = data.round2.filter((r) => r.game_id === game.id);

  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  // Which players are unassigned?
  const assignedIds = new Set(gameGroups.map((g) => g.contestant_id));
  const unassigned = data.contestants.filter((c) => !assignedIds.has(c.id));

  async function handleAssign(contestantId: string, groupNumber: number) {
    await upsertCrockGroup(game.id, contestantId, groupNumber, null, null);
    onMutate();
  }

  async function handleClearAssignments() {
    if (!confirm("Clear all group assignments?")) return;
    await saveCrockAssignments(game.id, []);
    onMutate();
  }

  // Determine qualifiers: top 2 per group + best 3rd
  const grouped = new Map<number, typeof gameGroups>([1, 2, 3, 4].map((n) => [n, []]));
  for (const g of gameGroups) {
    if (g.group_number <= 4) grouped.get(g.group_number)?.push(g);
  }
  const qualifierIds = new Set<string>();
  const thirds: typeof gameGroups = [];
  for (const [, members] of grouped) {
    const sorted = members.filter((m) => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
    sorted.slice(0, 2).forEach((m) => qualifierIds.add(m.contestant_id));
    if (sorted[2]) thirds.push(sorted[2]);
  }
  if (thirds.length > 0) {
    const bestThird = [...thirds].sort((a, b) => a.time_seconds! - b.time_seconds!)[0];
    qualifierIds.add(bestThird.contestant_id);
  }
  // Override with manual advances flags
  for (const g of gameGroups) {
    if (g.advances === true) qualifierIds.add(g.contestant_id);
    if (g.advances === false) qualifierIds.delete(g.contestant_id);
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["groups", "knockout"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors touch-manipulation ${subTab === t ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {t === "groups" ? "🏟 Groups" : "⚡ Knockout"}
          </button>
        ))}
      </div>

      {subTab === "groups" && (
        <div>
          {/* Assign unassigned */}
          {unassigned.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
              <p className="text-xs font-semibold text-amber-300 mb-3">Assign players to groups</p>
              <div className="space-y-2">
                {unassigned.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-zinc-300">{getName(c.id)}</span>
                    {[1, 2, 3, 4].map((g) => (
                      <button key={g} onClick={() => handleAssign(c.id, g)}
                        className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-amber-500 hover:text-black touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        {String.fromCharCode(64 + g)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups with time entry */}
          {[1, 2, 3, 4].map((gn) => {
            const members = gameGroups.filter((g) => g.group_number === gn);
            if (members.length === 0) return null;
            const sorted = members.filter((m) => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
            return (
              <div key={gn} className="mb-4 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">{CROCK_GROUP_LABELS[gn]}</span>
                  <span className="text-xs text-zinc-500">{members.length} players · top 2 advance</span>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {members.map((g, i) => {
                    const isQ = sorted.indexOf(g) < 2 && g.time_seconds !== null;
                    const c = data.contestants.find((x) => x.id === g.contestant_id)!;
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-2">
                        <span className={`text-xs w-4 font-bold ${isQ ? "text-green-400" : "text-zinc-600"}`}>
                          {g.time_seconds !== null ? (sorted.indexOf(g) + 1) : "–"}
                        </span>
                        <span className="w-24 text-sm text-zinc-300 truncate">{getName(g.contestant_id)}</span>
                        <input
                          defaultValue={g.time_seconds !== null ? formatTime(g.time_seconds) : ""}
                          placeholder="e.g. 45.32" inputMode="decimal"
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none tabular-nums"
                          onBlur={async (e) => {
                            const secs = parseTime(e.target.value);
                            if (secs === null) return;
                            await upsertCrockGroup(game.id, g.contestant_id, gn, secs, g.advances);
                            onMutate();
                          }}
                        />
                        {isQ && <span className="text-xs text-green-400 shrink-0">→ KO</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {gameGroups.length > 0 && (
            <button onClick={handleClearAssignments}
              className="mt-2 w-full rounded-lg border border-zinc-800 py-2 text-xs text-zinc-600 hover:text-red-400 touch-manipulation">
              Clear all assignments
            </button>
          )}
        </div>
      )}

      {subTab === "knockout" && (
        <div>
          {qualifierIds.size === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">Enter group times first to see qualifiers</p>
          ) : (
            <div>
              <p className="text-xs text-zinc-500 mb-3">{qualifierIds.size} qualifiers — enter knockout times (lower = better)</p>
              <div className="space-y-1">
                {[...qualifierIds].map((cid) => {
                  const c = data.contestants.find((x) => x.id === cid)!;
                  if (!c) return null;
                  return (
                    <TimeRow key={cid} contestant={c} gameId={game.id} round="r2"
                      existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                      bracket="A"
                      onSave={async (secs) => {
                        const { error } = await upsertRound2(c.id, game.id, secs);
                        if (error) { toast.error("Save failed"); return; }
                        toast.success(`KO saved — ${c.nickname ?? c.full_name.split(" ")[0]}`);
                        onMutate();
                      }}
                      onDelete={async () => { await deleteRound2(c.id, game.id); onMutate(); }}
                    />
                  );
                })}
              </div>
              <div className="mt-4 rounded-lg border border-zinc-800 p-3">
                <p className="text-xs text-zinc-500">Non-qualifiers (positions {qualifierIds.size + 1}–11)</p>
                <div className="mt-2 space-y-1">
                  {data.contestants.filter((c) => !qualifierIds.has(c.id)).map((c) => {
                    const grp = gameGroups.find((g) => g.contestant_id === c.id);
                    return (
                      <div key={c.id} className="flex justify-between text-xs text-zinc-500">
                        <span>{getName(c.id)}</span>
                        <span>{grp?.time_seconds !== null ? formatTime(grp?.time_seconds ?? 0) : "–"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Bonus tab
// ──────────────────────────────────────────────────────────────

function BonusTab({ contestants, bonuses, onMutate }: {
  contestants: Contestant[]; bonuses: BonusPoint[]; onMutate: () => void;
}) {
  const [cid, setCid] = useState(contestants[0]?.id ?? "");
  const [pts, setPts] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const p = parseInt(pts, 10);
    if (isNaN(p) || p === 0) { toast.error("Enter a non-zero number"); return; }
    setSaving(true);
    const { error } = await addBonus(cid, p, reason.trim());
    setSaving(false);
    if (error) { toast.error("Failed"); return; }
    toast.success(`${p > 0 ? "+" : ""}${p} pts added`);
    setPts(""); setReason("");
    onMutate();
  }

  const grouped = contestants.map((c) => ({
    c, bs: bonuses.filter((b) => b.contestant_id === c.id),
    net: bonuses.filter((b) => b.contestant_id === c.id).reduce((s, b) => s + b.points, 0),
  })).filter((g) => g.bs.length > 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-800 p-4">
        <h3 className="mb-4 font-semibold text-zinc-200">Add +/− Points</h3>
        <div className="grid gap-3">
          <div className="flex gap-3">
            <select value={cid} onChange={(e) => setCid(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none">
              {contestants.map((c) => <option key={c.id} value={c.id}>{c.nickname ?? c.full_name}</option>)}
            </select>
            <input value={pts} onChange={(e) => setPts(e.target.value)} type="number"
              placeholder="+3 or -2"
              className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none" />
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none" />
          <button onClick={handleAdd} disabled={saving || !pts}
            className="rounded-lg bg-amber-500 py-2 font-semibold text-black hover:bg-amber-400 disabled:opacity-40">
            {saving ? "Adding…" : "Add Points"}
          </button>
        </div>
      </div>
      {grouped.map(({ c, bs, net }) => (
        <div key={c.id} className="rounded-xl border border-zinc-800 p-4">
          <div className="flex justify-between mb-2">
            <span className="font-semibold">{c.nickname ?? c.full_name}</span>
            <span className={`font-bold ${net > 0 ? "text-green-400" : "text-red-400"}`}>{net > 0 ? `+${net}` : net}</span>
          </div>
          {bs.map((b) => (
            <div key={b.id} className="flex justify-between text-sm py-0.5">
              <span className={`font-semibold mr-2 ${b.points > 0 ? "text-green-400" : "text-red-400"}`}>
                {b.points > 0 ? `+${b.points}` : b.points}
              </span>
              <span className="flex-1 text-zinc-400">{b.reason ?? "—"}</span>
              <button onClick={async () => { await deleteBonus(b.id); onMutate(); }}
                className="text-zinc-600 hover:text-red-400 text-xs ml-2">delete</button>
            </div>
          ))}
        </div>
      ))}
      {grouped.length === 0 && <p className="text-center text-zinc-600 text-sm py-8">No bonus points yet</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Contestants / PINs tab
// ──────────────────────────────────────────────────────────────

function ContestantsTab({ contestants }: { contestants: Contestant[] }) {
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="font-semibold text-zinc-200">PIN Codes</h3>
        <button onClick={() => window.print()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white">🖨 Print</button>
      </div>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/70 text-zinc-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Nickname</th>
              <th className="px-4 py-3 text-center font-mono">PIN</th>
              <th className="px-4 py-3 text-center">Photo</th>
            </tr>
          </thead>
          <tbody>
            {contestants.map((c) => (
              <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                <td className="px-4 py-3 font-medium">{c.full_name}</td>
                <td className="px-4 py-3 text-zinc-400">{c.nickname ?? <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3 text-center">
                  <span className="font-mono text-lg font-bold tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-md">{c.pin_code}</span>
                </td>
                <td className="px-4 py-3 text-center">{c.photo_url ? <span className="text-green-400 text-xs">✓</span> : <span className="text-zinc-700">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
