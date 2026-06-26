import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAll, formatTime, parseTime, computeGroupStandings,
  useBeerlympicsRealtime,
  type Game, type Participant,
} from "@/lib/beerlympics";
import { Trophy, ArrowLeft, Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADMIN_PASSWORD = "beerlympics2024";
const UNLOCK_KEY = "beerlympics-admin-unlocked";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  useBeerlympicsRealtime();
  const [unlocked, setUnlocked] = useState(
    typeof window !== "undefined" && sessionStorage.getItem(UNLOCK_KEY) === "1",
  );
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <AdminDashboard />;
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === ADMIN_PASSWORD) {
            sessionStorage.setItem(UNLOCK_KEY, "1");
            onUnlock();
          } else { setError(true); setPw(""); }
        }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 card-elev"
      >
        <div className="mb-6 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="font-display text-3xl gold-text">ADMIN ACCESS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the password to manage scores.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          placeholder="Password"
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground outline-none focus:border-primary"
        />
        {error && <p className="mt-2 text-sm text-destructive">Wrong password.</p>}
        <button type="submit" className="mt-4 w-full rounded-lg bg-primary py-3 font-bold text-primary-foreground hover:opacity-90">
          Unlock
        </button>
        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
          ← Back to leaderboard
        </Link>
      </form>
    </div>
  );
}

const TABS = ["Participants", "Games", "Scores", "Playoffs"] as const;
type Tab = typeof TABS[number];

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("Participants");
  const { data, isLoading } = useQuery({ queryKey: ["beerlympics"], queryFn: fetchAll });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl gold-text">BEERLYMPICS ADMIN</h1>
          </div>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Public view
          </Link>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-t-md px-4 py-2 text-sm font-semibold",
                tab === t ? "bg-background text-primary border-x border-t border-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {isLoading || !data ? <p className="text-muted-foreground">Loading…</p> : (
          <>
            {tab === "Participants" && <ParticipantsTab data={data} />}
            {tab === "Games" && <GamesTab data={data} />}
            {tab === "Scores" && <ScoresTab data={data} />}
            {tab === "Playoffs" && <PlayoffsTab data={data} />}
          </>
        )}
      </main>
    </div>
  );
}

type AllData = Awaited<ReturnType<typeof fetchAll>>;

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["beerlympics"] });
}

function ParticipantsTab({ data }: { data: AllData }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "team">("individual");
  const [members, setMembers] = useState("");
  const [color, setColor] = useState("#F5A623");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("participants").insert({
      name: name.trim(),
      type,
      members: type === "team" ? members.trim() || null : null,
      color,
    });
    if (error) toast.error(error.message); else {
      toast.success("Added"); setName(""); setMembers(""); invalidate();
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this participant?")) return;
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); invalidate(); }
  }

  return (
    <div className="space-y-6">
      <Card title="Add participant">
        <div className="grid gap-3 sm:grid-cols-5">
          <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as "individual" | "team")}>
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
          <input className={inputCls + " sm:col-span-2"} placeholder={type === "team" ? "Members (comma separated)" : "—"} disabled={type === "individual"} value={members} onChange={(e) => setMembers(e.target.value)} />
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-border bg-input" />
            <button onClick={add} className={primaryBtn}><Plus className="h-4 w-4" /> Add</button>
          </div>
        </div>
      </Card>

      <Card title={`Participants (${data.participants.length})`}>
        <div className="space-y-2">
          {data.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
              <span className="inline-block h-8 w-8 rounded-full" style={{ background: p.color }} />
              <div className="flex-1">
                <div className="font-semibold">{p.name} <span className="ml-2 text-xs text-muted-foreground">({p.type})</span></div>
                {p.members && <div className="text-xs text-muted-foreground">{p.members}</div>}
              </div>
              <button onClick={() => remove(p.id)} className={dangerBtn}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function GamesTab({ data }: { data: AllData }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [scoring, setScoring] = useState<"time" | "h2h">("time");
  const [partType, setPartType] = useState<"individual" | "team">("individual");
  const [pf, setPf] = useState(10);
  const [ps, setPs] = useState(6);
  const [pt, setPt] = useState(3);

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("games").insert({
      name: name.trim(),
      scoring_type: scoring,
      participant_type: partType,
      points_first: pf, points_second: ps, points_third: pt,
      sort_order: data.games.length,
    });
    if (error) toast.error(error.message); else { toast.success("Game added"); setName(""); invalidate(); }
  }
  async function update(id: string, patch: Partial<Game>) {
    const { error } = await supabase.from("games").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else invalidate();
  }
  async function remove(id: string) {
    if (!confirm("Delete this game and all its results?")) return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); invalidate(); }
  }

  return (
    <div className="space-y-6">
      <Card title="Add game">
        <div className="grid gap-3 sm:grid-cols-6">
          <input className={inputCls + " sm:col-span-2"} placeholder="Game name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={inputCls} value={scoring} onChange={(e) => setScoring(e.target.value as "time" | "h2h")}>
            <option value="time">Time</option>
            <option value="h2h">Head-to-head</option>
          </select>
          <select className={inputCls} value={partType} onChange={(e) => setPartType(e.target.value as "individual" | "team")}>
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
          <div className="flex gap-1 sm:col-span-2">
            <input className={inputCls} type="number" value={pf} onChange={(e) => setPf(+e.target.value)} title="1st pts" />
            <input className={inputCls} type="number" value={ps} onChange={(e) => setPs(+e.target.value)} title="2nd pts" />
            <input className={inputCls} type="number" value={pt} onChange={(e) => setPt(+e.target.value)} title="3rd pts" />
          </div>
          <button onClick={add} className={primaryBtn + " sm:col-span-6"}><Plus className="h-4 w-4" /> Add game</button>
        </div>
      </Card>

      <Card title={`Games (${data.games.length})`}>
        <div className="space-y-2">
          {data.games.map((g) => (
            <div key={g.id} className="rounded-lg border border-border bg-background/50 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.scoring_type} · {g.participant_type} · 🥇{g.points_first} 🥈{g.points_second} 🥉{g.points_third}</div>
                </div>
                <select className={inputCls + " w-40"} value={g.status} onChange={(e) => update(g.id, { status: e.target.value as Game["status"] })}>
                  <option value="upcoming">Upcoming</option>
                  <option value="group_stage">Group stage</option>
                  <option value="playoffs">Playoffs</option>
                  <option value="completed">Completed</option>
                </select>
                <button onClick={() => remove(g.id)} className={dangerBtn}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoresTab({ data }: { data: AllData }) {
  const invalidate = useInvalidate();
  const [gameId, setGameId] = useState<string>(data.games[0]?.id ?? "");
  const game = data.games.find((g) => g.id === gameId);

  if (!game) return <p className="text-muted-foreground">Add a game first.</p>;

  return (
    <div className="space-y-4">
      <select className={inputCls + " max-w-md"} value={gameId} onChange={(e) => setGameId(e.target.value)}>
        {data.games.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.scoring_type})</option>)}
      </select>

      {game.scoring_type === "time" ? (
        <TimeScores game={game} data={data} onChanged={invalidate} />
      ) : (
        <H2HScores game={game} data={data} onChanged={invalidate} />
      )}
    </div>
  );
}

function TimeScores({ game, data, onChanged }: { game: Game; data: AllData; onChanged: () => void }) {
  const [participantId, setParticipantId] = useState("");
  const [time, setTime] = useState("");

  async function save() {
    if (!participantId) return toast.error("Pick a participant");
    const t = parseTime(time);
    if (t === null) return toast.error("Invalid time. Use seconds or MM:SS.ms");
    const { error } = await supabase.from("time_results").upsert(
      { game_id: game.id, participant_id: participantId, time_seconds: t, updated_at: new Date().toISOString() },
      { onConflict: "game_id,participant_id" },
    );
    if (error) toast.error(error.message); else { toast.success("Saved"); setTime(""); onChanged(); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("time_results").delete().eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  }

  const results = data.timeResults.filter((r) => r.game_id === game.id).slice().sort((a, b) => a.time_seconds - b.time_seconds);
  const pmap = new Map(data.participants.map((p) => [p.id, p]));

  return (
    <Card title="Times">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <select className={inputCls + " sm:col-span-2"} value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
          <option value="">— Select participant —</option>
          {data.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className={inputCls} placeholder="Time (sec or MM:SS.ms)" value={time} onChange={(e) => setTime(e.target.value)} />
        <button onClick={save} className={primaryBtn}>Save time</button>
      </div>
      <div className="space-y-1">
        {results.map((r, i) => (
          <div key={r.id} className="flex items-center justify-between rounded border border-border bg-background/50 px-3 py-2 text-sm">
            <span className="w-6">{i + 1}.</span>
            <span className="flex-1">{pmap.get(r.participant_id)?.name ?? "?"}</span>
            <span className="font-mono gold-text">{formatTime(r.time_seconds)}</span>
            <button onClick={() => remove(r.id)} className="ml-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function H2HScores({ game, data, onChanged }: { game: Game; data: AllData; onChanged: () => void }) {
  const [pa, setPa] = useState(""); const [pb, setPb] = useState("");
  const [sa, setSa] = useState(""); const [sb, setSb] = useState("");
  const [stage, setStage] = useState<"group" | "playoff">("group");
  const [slot, setSlot] = useState("SF1");

  async function add() {
    if (!pa || !pb || pa === pb) return toast.error("Pick two different participants");
    const scoreA = parseInt(sa, 10), scoreB = parseInt(sb, 10);
    if (isNaN(scoreA) || isNaN(scoreB)) return toast.error("Enter both scores");
    const winner = scoreA === scoreB ? null : (scoreA > scoreB ? pa : pb);
    const groupName = stage === "group"
      ? (data.groups.find((g) => g.game_id === game.id && g.participant_id === pa)?.group_name ?? null)
      : null;
    const { error } = await supabase.from("h2h_matches").insert({
      game_id: game.id, participant_a: pa, participant_b: pb,
      score_a: scoreA, score_b: scoreB, winner_id: winner,
      stage, bracket_slot: stage === "playoff" ? slot : null, group_name: groupName,
    });
    if (error) toast.error(error.message); else { toast.success("Match added"); setSa(""); setSb(""); onChanged(); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("h2h_matches").delete().eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  }

  const matches = data.h2hMatches.filter((m) => m.game_id === game.id);
  const pmap = new Map(data.participants.map((p) => [p.id, p]));

  return (
    <Card title="Match results">
      <div className="grid gap-2 sm:grid-cols-8">
        <select className={inputCls + " sm:col-span-2"} value={pa} onChange={(e) => setPa(e.target.value)}>
          <option value="">— A —</option>
          {data.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className={inputCls} placeholder="Score A" value={sa} onChange={(e) => setSa(e.target.value)} />
        <input className={inputCls} placeholder="Score B" value={sb} onChange={(e) => setSb(e.target.value)} />
        <select className={inputCls + " sm:col-span-2"} value={pb} onChange={(e) => setPb(e.target.value)}>
          <option value="">— B —</option>
          {data.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as "group" | "playoff")}>
          <option value="group">Group</option>
          <option value="playoff">Playoff</option>
        </select>
        {stage === "playoff" ? (
          <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="SF1">SF1</option><option value="SF2">SF2</option>
            <option value="FINAL">Final</option><option value="THIRD">3rd</option>
          </select>
        ) : <div />}
        <button onClick={add} className={primaryBtn + " sm:col-span-8"}>Add match</button>
      </div>

      <div className="mt-4 space-y-1">
        {matches.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded border border-border bg-background/50 px-3 py-2 text-sm">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{m.stage}{m.bracket_slot ? `·${m.bracket_slot}` : m.group_name ? `·${m.group_name}` : ""}</span>
            <span className={cn("flex-1", m.winner_id === m.participant_a && "font-bold text-primary")}>{m.participant_a ? pmap.get(m.participant_a)?.name : "?"}</span>
            <span className="font-mono">{m.score_a}-{m.score_b}</span>
            <span className={cn("flex-1 text-right", m.winner_id === m.participant_b && "font-bold text-primary")}>{m.participant_b ? pmap.get(m.participant_b)?.name : "?"}</span>
            <button onClick={() => remove(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlayoffsTab({ data }: { data: AllData }) {
  const invalidate = useInvalidate();
  const h2hGames = data.games.filter((g) => g.scoring_type === "h2h");
  const [gameId, setGameId] = useState(h2hGames[0]?.id ?? "");
  const game = data.games.find((g) => g.id === gameId);

  if (!game) return <p className="text-muted-foreground">No head-to-head games yet.</p>;

  const assignedA = data.groups.filter((g) => g.game_id === gameId && g.group_name === "A");
  const assignedB = data.groups.filter((g) => g.game_id === gameId && g.group_name === "B");

  async function assign(pid: string, group: "A" | "B" | null) {
    if (group === null) {
      await supabase.from("participant_groups").delete().eq("game_id", gameId).eq("participant_id", pid);
    } else {
      await supabase.from("participant_groups").upsert(
        { game_id: gameId, participant_id: pid, group_name: group },
        { onConflict: "game_id,participant_id" },
      );
    }
    invalidate();
  }

  async function generateBracket() {
    const standings = computeGroupStandings(game!, data.h2hMatches);
    const inGroup = (id: string) => data.groups.find((g) => g.game_id === gameId && g.participant_id === id)?.group_name;
    const a = standings.filter((s) => inGroup(s.participant_id) === "A");
    const b = standings.filter((s) => inGroup(s.participant_id) === "B");
    if (a.length < 2 || b.length < 2) return toast.error("Need at least 2 in each group with played matches");
    const a1 = a[0].participant_id, a2 = a[1].participant_id;
    const b1 = b[0].participant_id, b2 = b[1].participant_id;
    await supabase.from("h2h_matches").delete().eq("game_id", gameId).eq("stage", "playoff");
    const rows = [
      { game_id: gameId, participant_a: a1, participant_b: b2, stage: "playoff", bracket_slot: "SF1" },
      { game_id: gameId, participant_a: b1, participant_b: a2, stage: "playoff", bracket_slot: "SF2" },
      { game_id: gameId, participant_a: null, participant_b: null, stage: "playoff", bracket_slot: "FINAL" },
      { game_id: gameId, participant_a: null, participant_b: null, stage: "playoff", bracket_slot: "THIRD" },
    ];
    const { error } = await supabase.from("h2h_matches").insert(rows);
    if (error) toast.error(error.message); else {
      await supabase.from("games").update({ status: "playoffs", updated_at: new Date().toISOString() }).eq("id", gameId);
      toast.success("Bracket generated");
      invalidate();
    }
  }

  async function advanceWinners() {
    const playoff = data.h2hMatches.filter((m) => m.game_id === gameId && m.stage === "playoff");
    const sf1 = playoff.find((m) => m.bracket_slot === "SF1");
    const sf2 = playoff.find((m) => m.bracket_slot === "SF2");
    const finalM = playoff.find((m) => m.bracket_slot === "FINAL");
    const thirdM = playoff.find((m) => m.bracket_slot === "THIRD");
    if (!sf1?.winner_id || !sf2?.winner_id) return toast.error("Both semifinals must have winners");
    const sf1Loser = sf1.participant_a === sf1.winner_id ? sf1.participant_b : sf1.participant_a;
    const sf2Loser = sf2.participant_a === sf2.winner_id ? sf2.participant_b : sf2.participant_a;
    if (finalM) await supabase.from("h2h_matches").update({ participant_a: sf1.winner_id, participant_b: sf2.winner_id, updated_at: new Date().toISOString() }).eq("id", finalM.id);
    if (thirdM) await supabase.from("h2h_matches").update({ participant_a: sf1Loser, participant_b: sf2Loser, updated_at: new Date().toISOString() }).eq("id", thirdM.id);
    toast.success("Final & 3rd place updated. Enter scores in the Scores tab.");
    invalidate();
  }

  return (
    <div className="space-y-4">
      <select className={inputCls + " max-w-md"} value={gameId} onChange={(e) => setGameId(e.target.value)}>
        {h2hGames.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>

      <Card title="Assign groups">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["A", "B"] as const).map((grp) => {
            const list = grp === "A" ? assignedA : assignedB;
            return (
              <div key={grp}>
                <h4 className="mb-2 font-display text-xl text-primary">Group {grp}</h4>
                <div className="space-y-1">
                  {list.map((g) => {
                    const p = data.participants.find((x) => x.id === g.participant_id);
                    return (
                      <div key={g.id} className="flex items-center justify-between rounded border border-border bg-background/50 px-3 py-1.5 text-sm">
                        <span>{p?.name}</span>
                        <button onClick={() => assign(g.participant_id, null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Unassigned</h4>
          <div className="flex flex-wrap gap-2">
            {data.participants
              .filter((p) => !data.groups.some((g) => g.game_id === gameId && g.participant_id === p.id))
              .map((p) => (
                <div key={p.id} className="flex items-center gap-1 rounded-lg border border-border bg-background/50 px-2 py-1 text-sm">
                  <span>{p.name}</span>
                  <button onClick={() => assign(p.id, "A")} className="rounded bg-primary/20 px-2 py-0.5 text-xs text-primary hover:bg-primary/30">→A</button>
                  <button onClick={() => assign(p.id, "B")} className="rounded bg-primary/20 px-2 py-0.5 text-xs text-primary hover:bg-primary/30">→B</button>
                </div>
              ))}
          </div>
        </div>
      </Card>

      <Card title="Bracket">
        <div className="flex flex-wrap gap-2">
          <button onClick={generateBracket} className={primaryBtn}>Generate / reset bracket</button>
          <button onClick={advanceWinners} className={primaryBtn}>Advance semifinal winners</button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Generate the bracket once group play is done. Enter SF1/SF2 scores in the Scores tab, then click "Advance winners" to populate Final & 3rd place.
        </p>
      </Card>
    </div>
  );
}

const inputCls = "rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const primaryBtn = "inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90";
const dangerBtn = "rounded-lg border border-border bg-background p-2 text-muted-foreground hover:border-destructive hover:text-destructive";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 card-elev">
      <h3 className="mb-4 font-display text-xl text-foreground">{title}</h3>
      {children}
    </div>
  );
}
