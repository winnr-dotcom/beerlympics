import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  resetRound2ForGame,
  resetChessboardGame,
  upsertCrockGroup,
  assignToR1Group,
  assignToR2Group,
  removeFromCrockGroup,
  upsertCrockFinal,
  deleteCrockFinal,
  resetCrockGame,
  saveTeamR1Time,
  saveTeamPlayoffTime,
  resetPoppKoppenGame,
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
import type { Contestant, BLGame, BonusPoint, TeamGamePlayer, LivesGameState, CrockFinal } from "@/lib/types";

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
          {data.games.map((g) => {
            const icon = g.game_type === "team_popp" ? " 👥" : g.game_type === "team_chess" ? " ♟️" : "";
            return <option key={g.id} value={g.id}>{g.name}{icon}</option>;
          })}
        </select>
        {game && (game.game_type === "team_popp" || game.game_type === "team_chess") && (
          <span className="text-xs text-amber-500 font-semibold">TEAM GAME</span>
        )}
      </div>

      {(game?.game_type === "individual" || game?.game_type === "individual_race") && (
        <IndividualTimesPanel key={game.id} game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "individual_points" && (
        <CanBaseballPanel key={game.id} game={game} data={data} onMutate={onMutate} />
      )}
      {(game?.game_type === "lives_bracket" || game?.game_type === "lives_no_playoff") && (
        <LivesPanel key={game.id} game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "cup_format" && (
        <CupFormatPanel key={game.id} game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "team_popp" && (
        <PoppKoppenPanel key={game.id} game={game} data={data} onMutate={onMutate} />
      )}
      {game?.game_type === "team_chess" && (
        <ChessboardPanel key={game.id} game={game} data={data} onMutate={onMutate} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Individual game time entry
// ──────────────────────────────────────────────────────────────

function IndividualTimesPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const isRace = game.game_type === "individual_race";
  const r1ForGame = data.round1.filter((r) => r.game_id === game.id);
  const r2ForGame = data.round2.filter((r) => r.game_id === game.id);
  const { bracketA, bracketB } = getBrackets(game.id, data.round1);
  const allR1Done = !isRace && r1ForGame.length >= data.contestants.length;

  const [r1Drafts, setR1Drafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of data.contestants) {
      const ex = r1ForGame.find((r) => r.contestant_id === c.id)?.time_seconds ?? null;
      init[c.id] = ex !== null ? formatTime(ex) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function handleSaveAll() {
    const entries = data.contestants
      .map((c) => ({ c, secs: parseTime(r1Drafts[c.id] ?? "") }))
      .filter((e): e is { c: Contestant; secs: number } => e.secs !== null && e.secs > 0);
    if (entries.length === 0) { toast.error("No valid times to save"); return; }
    setSaving(true);
    await Promise.all(entries.map(({ c, secs }) => upsertRound1(c.id, game.id, secs)));
    setSaving(false);
    toast.success(`Saved ${entries.length} R1 times`);
    onMutate();
  }

  async function handleResetAll() {
    if (!confirm("Clear all times for this game?")) return;
    setSaving(true);
    await Promise.all([
      ...r1ForGame.map((r) => deleteRound1(r.contestant_id, game.id)),
      ...r2ForGame.map((r) => deleteRound2(r.contestant_id, game.id)),
    ]);
    setR1Drafts(() => {
      const m: Record<string, string> = {};
      for (const c of data.contestants) m[c.id] = "";
      return m;
    });
    setSaving(false);
    toast.success("Times cleared");
    onMutate();
  }

  return (
    <>
      <div className="mb-5 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-200">Round 1 — All contestants</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Seconds (e.g. 45.321) or mm:ss.ms (e.g. 1:23.456)</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleResetAll} disabled={saving}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-500 hover:text-red-400 touch-manipulation">
              Reset
            </button>
            <button onClick={handleSaveAll} disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {saving ? "…" : "Save All"}
            </button>
          </div>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {data.contestants.map((c) => {
            const saved = r1ForGame.find((r) => r.contestant_id === c.id)?.time_seconds ?? null;
            const cur = r1Drafts[c.id] ?? "";
            // Show the bracket each contestant currently falls into, live as times are entered.
            const bracket = saved !== null ? (bracketA.includes(c.id) ? "A" : "B") : null;
            const name = c.nickname ?? c.full_name.split(" ")[0];
            return (
              <div key={c.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/20">
                {bracket && (
                  <span className={`text-xs font-bold w-4 shrink-0 ${bracket === "A" ? "text-green-400" : "text-zinc-500"}`}>{bracket}</span>
                )}
                <span className="w-24 text-sm text-zinc-300 truncate shrink-0">{name}</span>
                <input
                  value={cur}
                  onChange={(e) => setR1Drafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="e.g. 45.321"
                  inputMode="decimal"
                  className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none tabular-nums"
                />
                {saved !== null && (
                  <span className="text-xs text-zinc-500 shrink-0 tabular-nums">{formatTime(saved)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!isRace && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-zinc-200">Round 2 — Playoffs</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Bracket A → positions 1–6 · Bracket B → positions 7–{data.contestants.length}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 px-2 py-1 rounded-full ${allR1Done ? "bg-green-950 text-green-400" : "bg-amber-950 text-amber-400"}`}>
              {allR1Done ? "✓ Locked" : "● Provisional"}
            </span>
          </div>
          {bracketA.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">
              Enter Round 1 times to preview the playoff brackets
            </p>
          ) : (
            <div className="p-4 grid gap-4 sm:grid-cols-2">
              {([
                { ids: bracketA, label: "🏆 Bracket A (Top 6)", color: "text-green-400" },
                { ids: bracketB, label: "Bracket B (Bottom 5)", color: "text-zinc-400" },
              ] as const).map(({ ids, label, color }) => (
                <div key={label}>
                  <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</div>
                  <div className="space-y-0.5">
                    {ids.map((cid) => {
                      const c = data.contestants.find((x) => x.id === cid)!;
                      return (
                        <TimeRow key={cid} contestant={c} gameId={game.id} round="r2"
                          existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                          bracket={ids === bracketA ? "A" : "B"}
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
          )}
        </div>
      )}
    </>
  );
}

function TimeRow({ contestant, gameId, round, existing, bracket, onSave, onDelete }: {
  contestant: Contestant; gameId: string; round: "r1" | "r2"; existing: number | null;
  bracket: "A" | "B" | null; onSave: (s: number) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [val, setVal] = useState(existing !== null ? formatTime(existing) : "");
  const [saving, setSaving] = useState(false);
  const name = contestant.nickname ?? contestant.full_name.split(" ")[0];
  const isDirty = val !== (existing !== null ? formatTime(existing) : "");

  async function handleSave() {
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
        placeholder="e.g. 45.321" inputMode="decimal"
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
// Can Baseball — points game with bulk Save All + both playoffs
// ──────────────────────────────────────────────────────────────

function PointsPlayoffRow({ contestant, gameId, existing, onMutate }: {
  contestant: Contestant; gameId: string; existing: number | null; onMutate: () => void;
}) {
  const [val, setVal] = useState(existing !== null ? existing.toString() : "");
  const isDirty = val !== (existing !== null ? existing.toString() : "");
  const name = contestant.nickname ?? contestant.full_name.split(" ")[0];
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/20">
      <span className="w-24 text-sm text-zinc-300 truncate shrink-0">{name}</span>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 7" inputMode="decimal"
        className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none tabular-nums" />
      {isDirty && val && (
        <button onClick={async () => {
          const pts = parseFloat(val);
          if (isNaN(pts)) { toast.error("Invalid score"); return; }
          const { error } = await upsertRound2(contestant.id, gameId, pts);
          if (error) { toast.error("Save failed"); return; }
          toast.success(`Saved — ${name}`);
          onMutate();
        }} className="rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>Save</button>
      )}
      {!isDirty && existing !== null && (
        <button onClick={async () => { await deleteRound2(contestant.id, gameId); setVal(""); onMutate(); }}
          className="rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-500 hover:text-red-400 shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>×</button>
      )}
    </div>
  );
}

function CanBaseballPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const r1 = data.round1.filter((r) => r.game_id === game.id);
  const r2 = data.round2.filter((r) => r.game_id === game.id);

  // Bracket A = top 6 by score (descending), Bracket B = bottom 5
  const r1sorted = [...r1].sort((a, b) => b.time_seconds - a.time_seconds);
  const bracketA = r1sorted.slice(0, 6).map((r) => r.contestant_id);
  const bracketB = r1sorted.slice(6).map((r) => r.contestant_id);
  const hasBrackets = r1sorted.length >= 11;

  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of data.contestants) {
      const ex = r1.find((r) => r.contestant_id === c.id)?.time_seconds ?? null;
      init[c.id] = ex !== null ? ex.toString() : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function handleSaveAll() {
    const entries = data.contestants
      .map((c) => ({ c, val: parseFloat(scores[c.id] ?? "") }))
      .filter(({ val }) => !isNaN(val) && val >= 0);
    if (entries.length === 0) { toast.error("No scores to save"); return; }
    setSaving(true);
    await Promise.all(entries.map(({ c, val }) => upsertRound1(c.id, game.id, val)));
    setSaving(false);
    toast.success(`Saved ${entries.length} scores`);
    onMutate();
  }

  async function handleResetAll() {
    if (!confirm("Clear all Can Baseball scores?")) return;
    setSaving(true);
    const all = [...r1, ...r2];
    await Promise.all([
      ...r1.map((r) => deleteRound1(r.contestant_id, game.id)),
      ...r2.map((r) => deleteRound2(r.contestant_id, game.id)),
    ]);
    setScores(() => {
      const m: Record<string, string> = {};
      for (const c of data.contestants) m[c.id] = "";
      return m;
    });
    setSaving(false);
    toast.success("Scores cleared");
    onMutate();
  }

  return (
    <>
      <div className="mb-5 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-200">Can Baseball — Scores (higher = better)</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Enter all scores, then Save All</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleResetAll} disabled={saving}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-500 hover:text-red-400 touch-manipulation">
              Reset
            </button>
            <button onClick={handleSaveAll} disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {saving ? "…" : "Save All"}
            </button>
          </div>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {data.contestants.map((c) => {
            const name = c.nickname ?? c.full_name.split(" ")[0];
            const saved = r1.find((r) => r.contestant_id === c.id)?.time_seconds ?? null;
            const cur = scores[c.id] ?? "";
            const isDirty = cur !== (saved !== null ? saved.toString() : "");
            const bracket = hasBrackets ? (bracketA.includes(c.id) ? "A" : "B") : null;
            return (
              <div key={c.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/20">
                {bracket && (
                  <span className={`text-xs font-bold w-4 shrink-0 ${bracket === "A" ? "text-green-400" : "text-zinc-500"}`}>{bracket}</span>
                )}
                <span className="w-24 text-sm text-zinc-300 truncate shrink-0">{name}</span>
                <input
                  value={cur}
                  onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="e.g. 7"
                  inputMode="decimal"
                  className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none tabular-nums"
                />
                {saved !== null && (
                  <span className={`text-xs shrink-0 tabular-nums ${isDirty ? "text-amber-500" : "text-zinc-600"}`}>
                    {isDirty ? "● " : "✓ "}{saved}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hasBrackets && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800">
            <h3 className="font-semibold text-zinc-200">Playoffs</h3>
            <p className="text-xs text-zinc-500 mt-0.5">A bracket → positions 1–6 · B bracket → positions 7–11 · higher score = better</p>
          </div>
          <div className="p-4 grid gap-4 sm:grid-cols-2">
            {[{ ids: bracketA, label: "🏆 Bracket A (Top 6)", color: "text-green-400" },
              { ids: bracketB, label: "Bracket B (Bottom 5)", color: "text-zinc-400" }].map(({ ids, label, color }) => (
              <div key={label}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</div>
                <div className="space-y-0.5">
                  {ids.map((cid) => {
                    const c = data.contestants.find((x) => x.id === cid)!;
                    if (!c) return null;
                    return (
                      <PointsPlayoffRow key={cid} contestant={c} gameId={game.id}
                        existing={r2.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                        onMutate={onMutate}
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
        <p className="text-xs text-zinc-600 text-center py-3">Save all 11 scores to unlock playoff brackets</p>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Shared: Teams setup (Popp Koppen + Chessboard)
// 6 teams: Teams 1-5 are pairs, Team 6 is solo (#11 by standings)
// Auto-saves on first open; editable via dropdowns
// ──────────────────────────────────────────────────────────────

function TeamsSetup({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const leaderboard = computeLeaderboard(
    data.contestants, data.games, data.round1, data.round2, data.bonuses,
    data.teamPlayers, data.teamRankings, data.chessboardMatches,
    data.livesStates, data.crockGroups, data.crockFinals,
  );
  const ranked = leaderboard.map((r) => r.contestant);
  const existingPlayers = data.teamPlayers.filter((p) => p.game_id === game.id);

  function buildDefault(): Record<string, number> {
    const m: Record<string, number> = {};
    [[0, 9], [1, 8], [2, 7], [3, 6], [4, 5]].forEach(([ia, ib], i) => {
      if (ranked[ia]) m[ranked[ia].id] = i + 1;
      if (ranked[ib]) m[ranked[ib].id] = i + 1;
    });
    if (ranked[10]) m[ranked[10].id] = 6;
    return m;
  }

  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    if (existingPlayers.length > 0) {
      const m: Record<string, number> = {};
      for (const p of existingPlayers) m[p.contestant_id] = p.team_number;
      return m;
    }
    return ranked.length >= 11 ? buildDefault() : {};
  });
  const [saving, setSaving] = useState(false);

  // Auto-save defaults on first open if no teams exist
  useEffect(() => {
    if (existingPlayers.length === 0 && ranked.length >= 11) {
      const defaults = buildDefault();
      setAssignments(defaults);
      saveTeamAssignments(
        game.id,
        Object.entries(defaults).map(([cid, team]) => ({ contestantId: cid, teamNumber: team, isDisplaced: false })),
      ).then(() => onMutate());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function doSave(map: Record<string, number>) {
    setSaving(true);
    const { error } = await saveTeamAssignments(
      game.id,
      Object.entries(map).map(([cid, team]) => ({ contestantId: cid, teamNumber: team, isDisplaced: false })),
    );
    setSaving(false);
    if (error) { toast.error("Save failed"); return; }
    onMutate();
  }

  async function handleSave() {
    await doSave(assignments);
    toast.success("Teams saved!");
  }

  async function handleAutoSet() {
    const defaults = buildDefault();
    setAssignments(defaults);
    await doSave(defaults);
    toast.success("Auto-set from standings!");
  }

  const getName = (c: Contestant) => c.nickname ?? c.full_name.split(" ")[0];
  const teamGroups = [1, 2, 3, 4, 5, 6].map((t) => ({
    team: t,
    members: ranked.filter((c) => assignments[c.id] === t),
  }));

  return (
    <div>
      {/* Standings */}
      <div className="mb-4 rounded-lg border border-zinc-800 p-3">
        <p className="text-xs font-semibold text-zinc-400 mb-2">Standings — teams auto-set from these (#1+#10, #2+#9, … #11 solo)</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
          {leaderboard.slice(0, 11).map((r) => (
            <div key={r.contestant.id}>#{r.rank} {getName(r.contestant)} <span className="text-zinc-600">({r.total}pts)</span></div>
          ))}
        </div>
      </div>

      {/* Team summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {teamGroups.map(({ team, members }) => (
          <div key={team} className={`rounded-lg border p-2.5 ${team === 6 ? "border-amber-900/50 bg-amber-950/10" : "border-zinc-800"}`}>
            <div className="text-xs font-semibold mb-1">
              <span className="text-amber-500">Team {team}</span>
              {team === 6 && <span className="text-zinc-500 ml-1">(solo)</span>}
            </div>
            {members.length === 0
              ? <div className="text-xs text-zinc-700">—</div>
              : members.map((c) => <div key={c.id} className="text-xs text-zinc-300">{getName(c)}</div>)}
          </div>
        ))}
      </div>

      {/* Reassignment table */}
      <div className="mb-4 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">Change team assignments</span>
          <button onClick={handleAutoSet} disabled={saving}
            className="text-xs text-amber-500 hover:text-amber-400 touch-manipulation" style={{ WebkitTapHighlightColor: "transparent" }}>
            ↺ Reset to standings
          </button>
        </div>
        <div className="divide-y divide-zinc-800/40">
          {ranked.slice(0, 11).map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="text-xs text-zinc-600 w-5 shrink-0">#{i + 1}</span>
              <span className="flex-1 text-sm text-zinc-300">{getName(c)}</span>
              <select
                value={assignments[c.id] ?? ""}
                onChange={(e) => setAssignments((prev) => ({ ...prev, [c.id]: parseInt(e.target.value, 10) }))}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white focus:border-amber-500 focus:outline-none touch-manipulation">
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((t) => (
                  <option key={t} value={t}>T{t}{t === 6 ? " (solo)" : ""}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-black hover:bg-amber-400 disabled:opacity-40 touch-manipulation"
        style={{ WebkitTapHighlightColor: "transparent" }}>
        {saving ? "Saving…" : "Save Teams"}
      </button>
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
              <span className="text-xs text-zinc-400">→ {rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : rank === 4 ? "4th" : rank === 5 ? "5th" : "6th"} place</span>
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
  const [resetNonce, setResetNonce] = useState(0);
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const gameRankings = data.teamRankings.filter((r) => r.game_id === game.id);
  const activeTeams = [1, 2, 3, 4, 5, 6].filter((t) => gamePlayers.some((p) => p.team_number === t));
  const half = Math.ceil(activeTeams.length / 2);

  async function handleReset() {
    if (!confirm("Reset all Popp Koppen times and rankings? Team assignments will be kept.")) return;
    const { error } = await resetPoppKoppenGame(game.id);
    if (error) { toast.error("Reset failed"); return; }
    setResetNonce((n) => n + 1); // remount sub-panels so their draft inputs clear
    toast.success("Popp Koppen results cleared");
    onMutate();
  }

  // Compute team ranks from times (not stored rank column)
  const r1Map = new Map<number, number>(
    gameRankings.filter((r) => r.r1_time_seconds != null).map((r) => [r.team_number, r.r1_time_seconds!]),
  );
  const playoffMap = new Map<number, number>(
    gameRankings.filter((r) => r.playoff_time_seconds != null).map((r) => [r.team_number, r.playoff_time_seconds!]),
  );
  const r1Ranked = [...activeTeams].filter((t) => r1Map.has(t)).sort((a, b) => r1Map.get(a)! - r1Map.get(b)!);
  const allR1Done = r1Ranked.length === activeTeams.length;
  const ranksMap = new Map<number, number>();
  if (allR1Done) {
    const topG = r1Ranked.slice(0, half);
    const botG = r1Ranked.slice(half);
    const topPO = [...topG].filter((t) => playoffMap.has(t)).sort((a, b) => playoffMap.get(a)! - playoffMap.get(b)!);
    const botPO = [...botG].filter((t) => playoffMap.has(t)).sort((a, b) => playoffMap.get(a)! - playoffMap.get(b)!);
    (topPO.length === topG.length ? topPO : topG).forEach((t, i) => ranksMap.set(t, i + 1));
    (botPO.length === botG.length ? botPO : botG).forEach((t, i) => ranksMap.set(t, half + i + 1));
  } else {
    r1Ranked.forEach((t, i) => ranksMap.set(t, i + 1));
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-1.5">
        {([["teams", "👥 Teams"], ["rankings", "🏆 Rankings"], ["tiebreakers", "⚡ Tiebreakers"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${subTab === key ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {label}
          </button>
        ))}
        <button onClick={handleReset}
          className="ml-auto rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:border-red-900 transition-colors touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Reset
        </button>
      </div>

      {subTab === "teams" && <TeamsSetup key={`teams-${resetNonce}`} game={game} data={data} onMutate={onMutate} />}
      {subTab === "rankings" && <PoppKoppenRankings key={`rankings-${resetNonce}`} game={game} data={data} onMutate={onMutate} />}
      {subTab === "tiebreakers" && <TiebreakersSetup key={`tb-${resetNonce}`} game={game} data={data} ranks={ranksMap} onMutate={onMutate} />}
    </div>
  );
}

function PoppKoppenRankings({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const gamePlayers = data.teamPlayers.filter((p) => p.game_id === game.id);
  const gameRankings = data.teamRankings.filter((r) => r.game_id === game.id);

  const [r1Draft, setR1Draft] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const r of gameRankings) if (r.r1_time_seconds != null) init[r.team_number] = formatTime(r.r1_time_seconds);
    return init;
  });
  const [playoffDraft, setPlayoffDraft] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const r of gameRankings) if (r.playoff_time_seconds != null) init[r.team_number] = formatTime(r.playoff_time_seconds);
    return init;
  });

  if (gamePlayers.length === 0) {
    return <p className="text-sm text-zinc-600 py-4 text-center">Set teams first</p>;
  }

  const getName = (id: string) => { const c = data.contestants.find((x) => x.id === id); return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?"; };
  const getTeamLabel = (t: number) => gamePlayers.filter((p) => p.team_number === t).map((p) => getName(p.contestant_id)).join(" + ");
  const ord = (n: number) => n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

  const activeTeams = [1, 2, 3, 4, 5, 6].filter((t) => gamePlayers.some((p) => p.team_number === t));
  const n = activeTeams.length;
  const half = Math.ceil(n / 2);

  const r1Saved = new Map<number, number>(
    gameRankings.filter((r) => r.r1_time_seconds != null).map((r) => [r.team_number, r.r1_time_seconds!]),
  );
  const playoffSaved = new Map<number, number>(
    gameRankings.filter((r) => r.playoff_time_seconds != null).map((r) => [r.team_number, r.playoff_time_seconds!]),
  );
  const r1Ranked = [...activeTeams].filter((t) => r1Saved.has(t)).sort((a, b) => r1Saved.get(a)! - r1Saved.get(b)!);
  const allR1Done = r1Ranked.length === n;
  const topGroup = allR1Done ? r1Ranked.slice(0, half) : [];
  const botGroup = allR1Done ? r1Ranked.slice(half) : [];

  async function handleR1Save(teamNum: number) {
    const secs = parseTime(r1Draft[teamNum] ?? "");
    if (secs === null) { toast.error("Invalid time — use M:SS"); return; }
    const { error } = await saveTeamR1Time(game.id, teamNum, secs);
    if (error) { toast.error("Save failed"); return; }
    toast.success(`Team ${teamNum} R1 time saved`);
    onMutate();
  }

  async function handlePlayoffSave(teamNum: number) {
    const secs = parseTime(playoffDraft[teamNum] ?? "");
    if (secs === null) { toast.error("Invalid time — use M:SS"); return; }
    const { error } = await saveTeamPlayoffTime(game.id, teamNum, secs);
    if (error) { toast.error("Save failed"); return; }
    toast.success(`Team ${teamNum} playoff time saved`);
    onMutate();
  }

  function TimeRow({ teamNum, draft, setDraft, savedTime, onSave, accent }: {
    teamNum: number; draft: Record<number, string>; setDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    savedTime: number | null; onSave: () => void; accent?: boolean;
  }) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold ${accent ? "text-amber-500" : "text-zinc-500"}`}>Team {teamNum}</p>
          <p className="text-sm text-zinc-300 truncate">{getTeamLabel(teamNum)}</p>
        </div>
        {savedTime != null && <span className="text-xs font-mono text-zinc-500">{formatTime(savedTime)}</span>}
        <input
          type="text" value={draft[teamNum] ?? ""} placeholder="M:SS"
          onChange={(e) => setDraft((p) => ({ ...p, [teamNum]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
          className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-center text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
        />
        <button onClick={onSave}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Save
        </button>
      </div>
    );
  }

  function StandingsBox({ teams, timeMap, offset }: { teams: number[]; timeMap: Map<number, number>; offset: number }) {
    const ranked = [...teams].filter((t) => timeMap.has(t)).sort((a, b) => timeMap.get(a)! - timeMap.get(b)!);
    if (ranked.length === 0) return null;
    return (
      <div className="mt-2 space-y-1 rounded border border-zinc-800/50 px-3 py-2">
        {ranked.map((t, i) => (
          <div key={t} className="flex items-center justify-between text-xs">
            <span className="w-6 text-zinc-500">#{offset + i + 1}</span>
            <span className="flex-1 text-zinc-300">{getTeamLabel(t)}</span>
            <span className="font-mono text-amber-400">{formatTime(timeMap.get(t)!)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* R1 time entry */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Round 1 Times</p>
        <div className="space-y-2">
          {activeTeams.map((t) => (
            <TimeRow key={t} teamNum={t} draft={r1Draft} setDraft={setR1Draft}
              savedTime={r1Saved.get(t) ?? null} onSave={() => handleR1Save(t)} accent />
          ))}
        </div>
        <StandingsBox teams={activeTeams} timeMap={r1Saved} offset={0} />
      </div>

      {/* Playoff section — only shown when all R1 times are saved */}
      {allR1Done && (
        <>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Playoffs</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-amber-400">{ord(1)} – {ord(half)} Place Playoff</p>
            <div className="space-y-2">
              {topGroup.map((t) => (
                <TimeRow key={t} teamNum={t} draft={playoffDraft} setDraft={setPlayoffDraft}
                  savedTime={playoffSaved.get(t) ?? null} onSave={() => handlePlayoffSave(t)} accent />
              ))}
            </div>
            <StandingsBox teams={topGroup} timeMap={playoffSaved} offset={0} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500">{ord(half + 1)} – {ord(n)} Place Playoff</p>
            <div className="space-y-2">
              {botGroup.map((t) => (
                <TimeRow key={t} teamNum={t} draft={playoffDraft} setDraft={setPlayoffDraft}
                  savedTime={playoffSaved.get(t) ?? null} onSave={() => handlePlayoffSave(t)} />
              ))}
            </div>
            <StandingsBox teams={botGroup} timeMap={playoffSaved} offset={half} />
          </div>
        </>
      )}
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

  async function handleReset() {
    if (!confirm("Reset all Chessboard match results and rankings? Team assignments will be kept.")) return;
    await resetChessboardGame(game.id);
    toast.success("Chessboard results cleared");
    onMutate();
  }

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {([["teams", "👥 Teams"], ["league", "♟️ League"], ["tiebreakers", "⚡ Tiebreakers"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${subTab === key ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {label}
          </button>
        ))}
        <button onClick={handleReset}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 hover:text-red-400 touch-manipulation shrink-0"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Reset
        </button>
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
    gamePlayers.filter((p) => p.team_number === teamNum);
  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  // League standings with points + goal diff (6 teams)
  const ranksMap = computeChessboardTeamRanks(game.id, data.chessboardMatches);
  const activeTeamNums = [1, 2, 3, 4, 5, 6].filter((t) => gamePlayers.some((p) => p.team_number === t));
  const pts = new Map(activeTeamNums.map((t) => [t, 0]));
  const gf  = new Map(activeTeamNums.map((t) => [t, 0]));
  const ga  = new Map(activeTeamNums.map((t) => [t, 0]));
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
      {/* Standings — always visible once teams are set */}
      {activeTeamNums.length > 0 && (
        <div className="mb-5 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-300">League standings ({played}/{CHESS_PAIRS.length} played)</span>
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
                const teamName = members.map((m) => getName(m.contestant_id)).join(" & ") || `Team ${team}`;
                return (
                  <tr key={team} className="border-b border-zinc-800/40">
                    <td className="px-3 py-2 font-bold text-amber-400">{rank}</td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">{teamName}</td>
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
          const teamAName = aMembers.map((m) => getName(m.contestant_id)).join(" & ") || `Team ${ta}`;
          const teamBName = bMembers.map((m) => getName(m.contestant_id)).join(" & ") || `Team ${tb}`;

          return (
            <ChessMatchRow key={`${ta}-${tb}`}
              gameId={game.id} teamA={ta} teamB={tb}
              teamAName={teamAName} teamBName={teamBName}
              aMembers={aMembers} bMembers={bMembers}
              existing={existing ?? null}
              getName={getName}
              onSave={async (playerAId, playerBId, scoreA, scoreB) => {
                const { error } = await upsertChessboardMatch(game.id, ta, tb, playerAId, playerBId, scoreA, scoreB);
                if (error) { toast.error("Save failed"); return; }
                toast.success(`${teamAName} vs ${teamBName} — result saved`);
                onMutate();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChessMatchRow({ gameId, teamA, teamB, teamAName, teamBName, aMembers, bMembers, existing, getName, onSave }: {
  gameId: string; teamA: number; teamB: number;
  teamAName: string; teamBName: string;
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
    ? sa > sb ? `${teamAName} wins` : sb > sa ? `${teamBName} wins` : "Draw"
    : null;

  return (
    <div className={`rounded-lg border px-4 py-3 ${done ? "border-green-800 bg-green-950/10" : "border-zinc-800"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-400">{teamAName} vs {teamBName}</span>
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
  const hasPlayoff = game.game_type !== "lives_no_playoff";
  const [subTab, setSubTab] = useState<"lives" | "playoffs">("lives");
  const states = data.livesStates.filter((s) => s.game_id === game.id);
  const { bracketA, bracketB } = getLivesBrackets(game.id, data.livesStates);
  const r2ForGame = data.round2.filter((r) => r.game_id === game.id);

  const eliminated = states.filter((s) => s.eliminated_order !== null).sort((a, b) => a.eliminated_order! - b.eliminated_order!);
  const nextElimOrder = eliminated.length + 1;

  const getName = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?";
  };

  async function handleReset() {
    if (!confirm("Reset lives game? All scores will be cleared from the leaderboard.")) return;
    await resetLivesGame(game.id);
    await resetRound2ForGame(game.id);
    toast.success("Lives game reset — click Start to begin again");
    onMutate();
  }

  async function handleInit() {
    await resetLivesGame(game.id);
    await resetRound2ForGame(game.id);
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
        <button onClick={() => setSubTab("lives")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors touch-manipulation ${subTab === "lives" ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
          style={{ WebkitTapHighlightColor: "transparent" }}>
          ❤️ Lives
        </button>
        {hasPlayoff && (
          <button onClick={() => setSubTab("playoffs")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors touch-manipulation ${subTab === "playoffs" ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            🏆 Playoffs
          </button>
        )}
        <button onClick={handleReset}
          className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-600 hover:text-red-400 touch-manipulation shrink-0">
          Reset
        </button>
      </div>

      {subTab === "lives" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 mb-3">
            {eliminated.length}/5 eliminated{hasPlayoff ? ` · ${5 - eliminated.length} more until playoffs` : ""}
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
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-green-400 mb-2">🏆 Top 6 — positions 1-6 (lower = better)</p>
                <div className="space-y-1">
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
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-2">Bottom 5 — positions 7-11 (lower = better)</p>
                <div className="space-y-1">
                  {bracketB.map((cid) => {
                    const c = data.contestants.find((x) => x.id === cid)!;
                    if (!c) return null;
                    return (
                      <TimeRow key={cid} contestant={c} gameId={game.id} round="r2"
                        existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                        bracket="B"
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
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Cup format panel (Crock it) — multi-round tournament
// R1: 4 groups (A,B,C=3 players; D=2+wildcard from A/B best 3rd)
// R2: 2 groups of 4 — top 2 → Final; bottom 2 → R2 Consolation
// Finals: positions 1-4 | R2 Consol: 5-8 | R1 Consol: 9-11
// ──────────────────────────────────────────────────────────────

const CROCK_GROUP_LABELS: Record<number, string> = {
  1: "Group A", 2: "Group B", 3: "Group C", 4: "Group D",
};

function CrockFinalRow({
  contestant, gameId, stage, existing, onMutate,
}: {
  contestant: Contestant;
  gameId: string;
  stage: CrockFinal["stage"];
  existing: number | null;
  onMutate: () => void;
}) {
  const [val, setVal] = useState(existing !== null ? formatTime(existing) : "");
  const [saving, setSaving] = useState(false);
  const isDirty = val.trim() !== (existing !== null ? formatTime(existing) : "");
  const name = contestant.nickname ?? contestant.full_name.split(" ")[0];

  async function handleSave() {
    const secs = parseTime(val);
    if (secs === null) { toast.error("Invalid time"); return; }
    setSaving(true);
    const { error } = await upsertCrockFinal(contestant.id, gameId, stage, secs);
    setSaving(false);
    if (error) { toast.error("Save failed"); return; }
    toast.success(`Saved — ${name}`);
    onMutate();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="flex-1 text-sm text-zinc-300 truncate">{name}</span>
      <input
        value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        placeholder="45.321" inputMode="decimal"
        className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none tabular-nums"
      />
      {isDirty && (
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-amber-500 px-3 py-2.5 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-40 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {saving ? "…" : "Save"}
        </button>
      )}
      {!isDirty && existing !== null && (
        <button onClick={async () => { await deleteCrockFinal(contestant.id, gameId, stage); onMutate(); }}
          className="px-2 text-xs text-zinc-600 hover:text-red-400 touch-manipulation">×</button>
      )}
    </div>
  );
}

function CupFormatPanel({ game, data, onMutate }: { game: BLGame; data: FetchAllResult; onMutate: () => void }) {
  const [picker, setPicker] = useState<{ stage: "r1" | "r2"; group: number } | null>(null);

  const r1 = data.crockGroups.filter(g => g.game_id === game.id && g.stage === "r1");
  const r2 = data.crockGroups.filter(g => g.game_id === game.id && g.stage === "r2");
  const finals = data.crockFinals.filter(f => f.game_id === game.id);
  const getName = (id: string) => { const c = data.contestants.find(x => x.id === id); return c ? (c.nickname ?? c.full_name.split(" ")[0]) : "?"; };

  const r1g = (gn: number) => r1.filter(g => g.group_number === gn);
  const r2g = (gn: number) => r2.filter(g => g.group_number === gn);

  // ── R1 qualifiers ──────────────────────────────────────────
  const r1QualIds = new Set<string>();
  for (const gn of [1, 2, 3, 4]) {
    const sorted = r1g(gn).filter(m => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
    sorted.slice(0, 2).forEach(m => r1QualIds.add(m.contestant_id));
  }
  for (const g of r1) {
    if (g.advances === true) r1QualIds.add(g.contestant_id);
    if (g.advances === false) r1QualIds.delete(g.contestant_id);
  }
  const r1NonQualIds = [...new Set(r1.map(g => g.contestant_id))].filter(id => !r1QualIds.has(id));

  // Wildcard: best 3rd from A/B/C
  const abThirds: typeof r1 = [];
  for (const gn of [1, 2, 3]) {
    const s = r1g(gn).filter(m => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
    if (s[2]) abThirds.push(s[2]);
  }
  const wc = abThirds.length > 0 ? abThirds.sort((a, b) => a.time_seconds! - b.time_seconds!)[0] : null;
  const wcInD = wc ? r1.find(g => g.contestant_id === wc.contestant_id && g.group_number === 4) : null;

  // ── R2 qualifiers ──────────────────────────────────────────
  const r2FinalIds = new Set<string>();
  const r2ConsolIds = new Set<string>();
  for (const gn of [1, 2]) {
    const sorted = r2g(gn).filter(m => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
    sorted.slice(0, 2).forEach(m => r2FinalIds.add(m.contestant_id));
    sorted.slice(2).forEach(m => r2ConsolIds.add(m.contestant_id));
  }

  // Available players for pickers
  const r1AllAssigned = new Set(r1.map(g => g.contestant_id));
  const availForR1 = data.contestants.filter(c => !r1AllAssigned.has(c.id));
  const r2Assigned = new Set(r2.map(g => g.contestant_id));
  const availForR2 = [...r1QualIds].filter(id => !r2Assigned.has(id));

  // ── Slot renderer ──────────────────────────────────────────
  const renderSlot = (
    member: typeof r1[0] | undefined,
    key: string,
    stage: "r1" | "r2",
    groupNum: number,
    maxRank: number,
    qualBadge: string,
    isWcSlot?: boolean,
  ) => {
    if (!member) {
      return (
        <button key={key} type="button"
          onClick={() => !isWcSlot && setPicker({ stage, group: groupNum })}
          disabled={isWcSlot}
          className={`w-full py-3 rounded-lg border-2 border-dashed text-xs font-medium transition-colors touch-manipulation select-none
            ${isWcSlot ? "border-amber-900/30 text-amber-900/40 cursor-default" : "border-zinc-800 text-zinc-700 hover:border-zinc-600 hover:text-zinc-400 cursor-pointer"}`}
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {isWcSlot ? "🃏 WC — auto after A/B/C" : "+ Assign"}
        </button>
      );
    }
    const sortedGroup = (stage === "r1" ? r1g(groupNum) : r2g(groupNum))
      .filter(m => m.time_seconds !== null).sort((a, b) => a.time_seconds! - b.time_seconds!);
    const rank = sortedGroup.findIndex(m => m.contestant_id === member.contestant_id);
    const isQ = rank >= 0 && rank < maxRank && member.time_seconds !== null;
    const isWc = member.contestant_id === wc?.contestant_id && groupNum === 4;
    return (
      <div key={key} className={`rounded-lg border p-2 ${isQ ? "border-green-800/40 bg-green-950/10" : "border-zinc-800"}`}>
        <div className="flex items-center gap-1 mb-1.5">
          {isQ && <span className="text-[10px] font-bold text-green-400 w-3 shrink-0">{rank + 1}.</span>}
          <span className={`flex-1 text-xs font-medium truncate ${isQ ? "text-white" : "text-zinc-300"}`}>
            {getName(member.contestant_id)}{isWc && <span className="text-amber-400 ml-0.5 text-[10px]">★</span>}
          </span>
          {isQ && <span className="text-[10px] text-green-400 shrink-0">{qualBadge}</span>}
          <button type="button"
            onClick={async () => { await removeFromCrockGroup(game.id, member.contestant_id, groupNum, stage); onMutate(); }}
            className="ml-0.5 text-zinc-700 hover:text-red-400 text-xs w-4 h-4 flex items-center justify-center shrink-0 touch-manipulation">
            ×
          </button>
        </div>
        <input
          key={`${member.id}-${member.time_seconds ?? "x"}`}
          defaultValue={member.time_seconds !== null ? formatTime(member.time_seconds) : ""}
          placeholder="0:00.000" inputMode="decimal"
          className="w-full rounded bg-zinc-900 px-2 py-1.5 text-xs font-mono text-zinc-200 border border-zinc-800 focus:outline-none focus:border-amber-500"
          onBlur={async e => {
            const t = parseTime(e.target.value);
            if (t === null) return;
            await upsertCrockGroup(game.id, member.contestant_id, groupNum, t, member.advances, stage);
            onMutate();
          }}
          onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </div>
    );
  };

  const renderR1Group = (gn: number) => {
    const label = ["A", "B", "C", "D"][gn - 1];
    const isD = gn === 4;
    const members = r1g(gn);
    const regularMembers = isD ? members.filter(m => m.contestant_id !== wc?.contestant_id) : members;
    const regularSlots = isD ? 2 : 3;
    return (
      <div key={gn} className={`rounded-xl border overflow-hidden ${isD ? "border-amber-900/40" : "border-zinc-800"}`}>
        <div className={`px-3 py-2 border-b text-xs font-bold flex items-center justify-between
          ${isD ? "border-amber-900/40 bg-amber-950/20 text-amber-400" : "border-zinc-800 bg-zinc-900/50 text-zinc-300"}`}>
          <span>Group {label}</span>
          <span className="text-zinc-600 font-normal text-[10px]">top 2 →</span>
        </div>
        <div className="p-2 space-y-1.5">
          {Array.from({ length: regularSlots }).map((_, i) =>
            renderSlot(regularMembers[i], `r1-${gn}-${i}`, "r1", gn, 2, "→R2")
          )}
          {isD && (
            wcInD
              ? renderSlot(wcInD, "r1-4-wc", "r1", 4, 2, "→R2")
              : wc && !wcInD
                ? <button type="button" onClick={async () => { await assignToR1Group(game.id, wc.contestant_id, 4); onMutate(); }}
                    className="w-full py-2.5 rounded-lg border border-amber-800/50 bg-amber-950/20 text-xs text-amber-400 hover:bg-amber-950/50 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    🃏 {getName(wc.contestant_id)} ({formatTime(wc.time_seconds!)})
                  </button>
                : renderSlot(undefined, "r1-4-wc", "r1", 4, 2, "→R2", true)
          )}
        </div>
      </div>
    );
  };

  // ── Picker modal ───────────────────────────────────────────
  const pickerPlayers: Contestant[] = picker
    ? picker.stage === "r1"
      ? availForR1
      : availForR2.map(id => data.contestants.find(c => c.id === id)!).filter(Boolean)
    : [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button type="button" onClick={async () => { if (!confirm("Reset entire Crock it tournament?")) return; await resetCrockGame(game.id); onMutate(); }}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 hover:text-red-400 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Reset
        </button>
      </div>

      {/* ── Round 1 ── */}
      <div className="mb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Round 1</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(renderR1Group)}
        </div>
      </div>

      <div className="my-3 flex items-center gap-2">
        <div className="flex-1 h-px bg-zinc-800/50" />
        <span className="text-[10px] text-zinc-600">↓ top 2 per group → Round 2</span>
        <div className="flex-1 h-px bg-zinc-800/50" />
      </div>

      {/* ── Round 2 ── */}
      <div className="mb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Round 2</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map(gn => {
            const members = r2g(gn);
            return (
              <div key={gn} className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-300 flex justify-between items-center">
                  <span>Group {gn}</span>
                  <span className="text-zinc-600 font-normal text-[10px]">top 2 →Final</span>
                </div>
                <div className="p-2 space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) =>
                    renderSlot(members[i], `r2-${gn}-${i}`, "r2", gn, 2, "→F")
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {availForR2.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-900/30 bg-amber-950/10 p-3">
            <p className="text-xs text-amber-400 mb-2 font-medium">Assign R1 qualifiers to R2 groups:</p>
            <div className="space-y-1.5">
              {availForR2.map(id => (
                <div key={id} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-zinc-300">{getName(id)}</span>
                  {[1, 2].map(gn => (
                    <button key={gn} type="button"
                      onClick={async () => {
                        const { error } = await assignToR2Group(game.id, id, gn);
                        if (error) { toast.error("Assign failed — have you run migration v4?"); return; }
                        onMutate();
                      }}
                      className="rounded px-3 py-1.5 bg-zinc-800 text-xs text-zinc-300 hover:bg-amber-500 hover:text-black touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      G{gn}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="my-3 flex items-center gap-2">
        <div className="flex-1 h-px bg-zinc-800/50" />
        <span className="text-[10px] text-zinc-600">↓ top 2 from each R2 group → Final</span>
        <div className="flex-1 h-px bg-zinc-800/50" />
      </div>

      {/* ── Finals ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Finals</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([ ["final","🏆 1st–4th","border-amber-900/40 bg-amber-950/20","text-amber-400",r2FinalIds],
               ["consol_r2","5th–8th","border-zinc-800 bg-zinc-900/50","text-zinc-400",r2ConsolIds],
               ["consol_r1","9th–11th","border-zinc-800 bg-zinc-900/50","text-zinc-500",new Set(r1NonQualIds)],
             ] as const).map(([stage, label, border, color, playerSet]) => (
            <div key={stage} className={`rounded-xl border overflow-hidden ${border}`}>
              <div className={`px-3 py-2 border-b text-xs font-bold ${border} ${color}`}
                style={{ borderBottomWidth: "1px" }}>
                {label}
              </div>
              <div className="divide-y divide-zinc-800/40">
                {playerSet.size === 0
                  ? <p className="px-3 py-3 text-[10px] text-zinc-700 text-center">After {stage === "consol_r1" ? "R1" : "R2"}</p>
                  : [...playerSet].map(cid => {
                      const c = data.contestants.find(x => x.id === cid);
                      if (!c) return null;
                      return <CrockFinalRow key={cid} contestant={c} gameId={game.id}
                        stage={stage as CrockFinal["stage"]}
                        existing={finals.find(f => f.contestant_id === cid && f.stage === stage)?.time_seconds ?? null}
                        onMutate={onMutate} />;
                    })
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Player picker modal ── */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-3"
          onClick={() => setPicker(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-sm font-bold text-zinc-200">
                Assign to {picker.stage === "r1" ? `Group ${"ABCD"[picker.group - 1]}` : `R2 Group ${picker.group}`}
              </h3>
              <button type="button" onClick={() => setPicker(null)} className="text-zinc-500 hover:text-white text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {pickerPlayers.length === 0
                ? <p className="text-center py-8 text-sm text-zinc-600">No players available</p>
                : pickerPlayers.map(c => (
                    <button key={c.id} type="button"
                      onClick={async () => {
                        const { error } = picker.stage === "r1"
                          ? await assignToR1Group(game.id, c.id, picker.group)
                          : await assignToR2Group(game.id, c.id, picker.group);
                        if (error) { toast.error("Assign failed — have you run migration v4?"); return; }
                        setPicker(null);
                        onMutate();
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-zinc-800 text-sm font-medium text-zinc-200 transition-colors touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      {c.nickname ?? c.full_name.split(" ")[0]}
                    </button>
                  ))
              }
            </div>
          </div>
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
