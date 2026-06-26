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
} from "@/lib/api";
import { parseTime, formatTime, getBrackets } from "@/lib/scoring";
import type { Contestant, BLGame, BonusPoint } from "@/lib/types";

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

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"times" | "bonus" | "contestants">("times");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["beerlympics"],
    queryFn: fetchAll,
    staleTime: 0,
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Loading...</div>
    );
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["beerlympics"] });
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "times", label: "⏱ Times" },
    { key: "bonus", label: "⭐ Bonus" },
    { key: "contestants", label: "👥 PINs" },
  ];

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
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-amber-500 text-black"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "times" && (
          <TimesTab data={data} onMutate={invalidate} />
        )}
        {tab === "bonus" && (
          <BonusTab contestants={data.contestants} bonuses={data.bonuses} onMutate={invalidate} />
        )}
        {tab === "contestants" && (
          <ContestantsTab contestants={data.contestants} onMutate={invalidate} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Times tab
// ──────────────────────────────────────────────────────────────

function TimesTab({ data, onMutate }: { data: FetchAllResult; onMutate: () => void }) {
  const [gameId, setGameId] = useState<string>(data.games[0]?.id ?? "");
  const game = data.games.find((g) => g.id === gameId);

  const r1ForGame = data.round1.filter((r) => r.game_id === gameId);
  const r2ForGame = data.round2.filter((r) => r.game_id === gameId);

  const { bracketA, bracketB } = getBrackets(gameId, data.round1);
  const hasBrackets = bracketA.length > 0;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-zinc-400 whitespace-nowrap">Game:</label>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
        >
          {data.games.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {game && (
        <>
          {/* Round 1 */}
          <div className="mb-6 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800">
              <h3 className="font-semibold text-zinc-200">Round 1 — All contestants</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Enter time as seconds (e.g. 45.32) or mm:ss (e.g. 1:23.45)</p>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {data.contestants.map((c) => (
                <TimeRow
                  key={c.id}
                  contestant={c}
                  gameId={gameId}
                  round="r1"
                  existing={r1ForGame.find((r) => r.contestant_id === c.id)?.time_seconds ?? null}
                  bracket={hasBrackets ? (bracketA.includes(c.id) ? "A" : "B") : null}
                  onSave={async (secs) => {
                    const { error } = await upsertRound1(c.id, gameId, secs);
                    if (error) { toast.error("Save failed: " + error.message); return; }
                    toast.success(`R1 time saved for ${c.nickname ?? c.full_name.split(" ")[0]}`);
                    onMutate();
                  }}
                  onDelete={async () => {
                    const { error } = await deleteRound1(c.id, gameId);
                    if (error) { toast.error("Delete failed"); return; }
                    onMutate();
                  }}
                />
              ))}
            </div>
          </div>

          {/* Round 2 */}
          {hasBrackets && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="bg-zinc-900/70 px-4 py-3 border-b border-zinc-800">
                <h3 className="font-semibold text-zinc-200">Round 2 — Playoff times</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Bracket A (top 6) → places 1–6 · Bracket B (bottom 5) → places 7–11
                </p>
              </div>

              <div className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Bracket A */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-green-400 uppercase tracking-wide">🏆 Bracket A (Top 6)</div>
                  <div className="space-y-1">
                    {bracketA.map((cid) => {
                      const c = data.contestants.find((x) => x.id === cid)!;
                      return (
                        <TimeRow
                          key={cid}
                          contestant={c}
                          gameId={gameId}
                          round="r2"
                          existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                          bracket="A"
                          onSave={async (secs) => {
                            const { error } = await upsertRound2(c.id, gameId, secs);
                            if (error) { toast.error("Save failed: " + error.message); return; }
                            toast.success(`R2 time saved for ${c.nickname ?? c.full_name.split(" ")[0]}`);
                            onMutate();
                          }}
                          onDelete={async () => {
                            await deleteRound2(c.id, gameId);
                            onMutate();
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Bracket B */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Bracket B (Bottom 5)</div>
                  <div className="space-y-1">
                    {bracketB.map((cid) => {
                      const c = data.contestants.find((x) => x.id === cid)!;
                      return (
                        <TimeRow
                          key={cid}
                          contestant={c}
                          gameId={gameId}
                          round="r2"
                          existing={r2ForGame.find((r) => r.contestant_id === cid)?.time_seconds ?? null}
                          bracket="B"
                          onSave={async (secs) => {
                            const { error } = await upsertRound2(c.id, gameId, secs);
                            if (error) { toast.error("Save failed: " + error.message); return; }
                            toast.success(`R2 time saved for ${c.nickname ?? c.full_name.split(" ")[0]}`);
                            onMutate();
                          }}
                          onDelete={async () => {
                            await deleteRound2(c.id, gameId);
                            onMutate();
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hasBrackets && (
            <p className="text-xs text-zinc-600 text-center py-4">
              Enter all 11 Round 1 times to unlock playoff brackets
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TimeRow({
  contestant,
  gameId,
  round,
  existing,
  bracket,
  onSave,
  onDelete,
}: {
  contestant: Contestant;
  gameId: string;
  round: "r1" | "r2";
  existing: number | null;
  bracket: "A" | "B" | null;
  onSave: (secs: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [val, setVal] = useState(existing !== null ? formatTime(existing) : "");
  const [saving, setSaving] = useState(false);

  const name = contestant.nickname ?? contestant.full_name.split(" ")[0];
  const isDirty = val !== (existing !== null ? formatTime(existing) : "");

  async function handleSave() {
    const secs = parseTime(val);
    if (secs === null || secs <= 0) { toast.error("Invalid time format"); return; }
    setSaving(true);
    await onSave(secs);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800/30">
      {bracket && (
        <span className={`text-[10px] font-bold w-4 ${bracket === "A" ? "text-green-400" : "text-zinc-500"}`}>
          {bracket}
        </span>
      )}
      <span className="w-24 text-sm text-zinc-300 truncate">{name}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        placeholder="e.g. 45.32"
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none tabular-nums"
      />
      {isDirty && val && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? "…" : "Save"}
        </button>
      )}
      {!isDirty && existing !== null && (
        <button
          onClick={async () => { await onDelete(); setVal(""); }}
          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:border-red-800 hover:text-red-400"
          title="Clear time"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Bonus tab
// ──────────────────────────────────────────────────────────────

function BonusTab({
  contestants,
  bonuses,
  onMutate,
}: {
  contestants: Contestant[];
  bonuses: BonusPoint[];
  onMutate: () => void;
}) {
  const [cid, setCid] = useState(contestants[0]?.id ?? "");
  const [pts, setPts] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const p = parseInt(pts, 10);
    if (isNaN(p) || p === 0) { toast.error("Enter a non-zero number of points"); return; }
    setSaving(true);
    const { error } = await addBonus(cid, p, reason.trim());
    setSaving(false);
    if (error) { toast.error("Failed: " + (error as any).message); return; }
    toast.success(`${p > 0 ? "+" : ""}${p} points added`);
    setPts(""); setReason("");
    onMutate();
  }

  const grouped = contestants.map((c) => ({
    contestant: c,
    bonuses: bonuses.filter((b) => b.contestant_id === c.id),
    net: bonuses.filter((b) => b.contestant_id === c.id).reduce((s, b) => s + b.points, 0),
  })).filter((g) => g.bonuses.length > 0);

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="rounded-xl border border-zinc-800 p-4">
        <h3 className="mb-4 font-semibold text-zinc-200">Add +/− Points</h3>
        <div className="grid gap-3">
          <div className="flex gap-3">
            <select
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            >
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>{c.nickname ?? c.full_name}</option>
              ))}
            </select>
            <input
              value={pts}
              onChange={(e) => setPts(e.target.value)}
              placeholder="e.g. +3 or -2"
              className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none tabular-nums"
              type="number"
            />
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !pts}
            className="rounded-lg bg-amber-500 py-2 font-semibold text-black hover:bg-amber-400 disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add Points"}
          </button>
        </div>
      </div>

      {/* Existing bonuses */}
      {grouped.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Existing bonuses</h3>
          <div className="space-y-3">
            {grouped.map(({ contestant, bonuses: bs, net }) => (
              <div key={contestant.id} className="rounded-xl border border-zinc-800 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">{contestant.nickname ?? contestant.full_name}</span>
                  <span className={`text-sm font-bold ${net > 0 ? "text-green-400" : "text-red-400"}`}>
                    {net > 0 ? `+${net}` : net}
                  </span>
                </div>
                <div className="space-y-1">
                  {bs.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">
                        <span className={`font-semibold mr-2 ${b.points > 0 ? "text-green-400" : "text-red-400"}`}>
                          {b.points > 0 ? `+${b.points}` : b.points}
                        </span>
                        {b.reason ?? <span className="text-zinc-600">no reason</span>}
                      </span>
                      <button
                        onClick={async () => {
                          await deleteBonus(b.id);
                          onMutate();
                        }}
                        className="text-zinc-600 hover:text-red-400 text-xs"
                      >
                        delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {grouped.length === 0 && (
        <p className="text-center text-zinc-600 text-sm py-8">No bonus points yet</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Contestants / PINs tab
// ──────────────────────────────────────────────────────────────

function ContestantsTab({ contestants, onMutate }: { contestants: Contestant[]; onMutate: () => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-200">Contestant PIN Codes</h3>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-white"
        >
          🖨 Print
        </button>
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
                <td className="px-4 py-3 font-medium text-white">{c.full_name}</td>
                <td className="px-4 py-3 text-zinc-400">{c.nickname ?? <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3 text-center">
                  <span className="font-mono text-base font-bold tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-md">
                    {c.pin_code}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.photo_url ? (
                    <span className="text-green-400 text-xs">✓</span>
                  ) : (
                    <span className="text-zinc-700 text-xs">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-zinc-600 text-center">
        Distribute PINs to contestants. They log in at /login and can set their nickname + photo.
      </p>
    </div>
  );
}
