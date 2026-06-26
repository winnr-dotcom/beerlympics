import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Beer, Settings, Timer, Swords, Medal } from "lucide-react";
import { useState, useMemo } from "react";
import {
  fetchAll,
  formatTime,
  computeOverall,
  computeGameStandings,
  computeGroupStandings,
  lastUpdatedRecently,
  useBeerlympicsRealtime,
  type Game,
} from "@/lib/beerlympics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: PublicPage,
});

function PublicPage() {
  useBeerlympicsRealtime();
  const { data, isLoading } = useQuery({
    queryKey: ["beerlympics"],
    queryFn: fetchAll,
  });

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const overall = useMemo(() => {
    if (!data) return [];
    return computeOverall(data.games, data.participants, data.timeResults, data.h2hMatches);
  }, [data]);

  const isLive = data ? lastUpdatedRecently(data.games, data.timeResults, data.h2hMatches) : false;
  const selectedGame = data?.games.find((g) => g.id === selectedGameId) ?? data?.games[0];

  return (
    <div className="min-h-screen">
      <header className="hero-bg relative overflow-hidden border-b border-border">
        <div className="absolute right-4 top-4 z-10">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" /> Admin
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <Beer className="h-10 w-10 text-primary" />
            <Trophy className="h-12 w-12 text-primary glow rounded-full" />
            <Beer className="h-10 w-10 text-primary scale-x-[-1]" />
          </div>
          <h1 className="font-display text-6xl sm:text-8xl gold-text">BEERLYMPICS</h1>
          <p className="mt-1 font-display text-3xl sm:text-4xl text-foreground/80">2024</p>
          {isLive && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-bold tracking-wider text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive animate-live" />
              LIVE
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-3xl text-foreground">
            <Trophy className="h-7 w-7 text-primary" /> Overall Standings
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card card-elev">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Player / Team</th>
                  <th className="px-2 py-3 text-center">🥇</th>
                  <th className="px-2 py-3 text-center">🥈</th>
                  <th className="px-2 py-3 text-center">🥉</th>
                  <th className="px-4 py-3 text-center">Played</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && overall.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No participants yet. Add some in the admin panel.</td></tr>
                )}
                {overall.map((row, i) => (
                  <tr key={row.participant.id} className={cn("border-t border-border transition-colors hover:bg-secondary/30", i < 3 && "bg-secondary/20")}>
                    <td className="px-4 py-3 font-display text-2xl">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-8 w-8 rounded-full ring-2 ring-border" style={{ background: row.participant.color }} />
                        <div>
                          <div className="font-semibold text-foreground">{row.participant.name}</div>
                          {row.participant.type === "team" && row.participant.members && (
                            <div className="text-xs text-muted-foreground">{row.participant.members}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center font-mono">{row.gold}</td>
                    <td className="px-2 py-3 text-center font-mono">{row.silver}</td>
                    <td className="px-2 py-3 text-center font-mono">{row.bronze}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.played}</td>
                    <td className="px-4 py-3 text-right font-display text-2xl gold-text">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-3xl text-foreground">
            <Medal className="h-7 w-7 text-primary" /> Games
          </h2>
          {data && data.games.length === 0 && (
            <p className="text-muted-foreground">No games added yet.</p>
          )}
          {data && data.games.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {data.games.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGameId(g.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                      (selectedGame?.id === g.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/50",
                    )}
                  >
                    {g.scoring_type === "time" ? <Timer className="mr-1 inline h-3.5 w-3.5" /> : <Swords className="mr-1 inline h-3.5 w-3.5" />}
                    {g.name}
                    <StatusPill status={g.status} />
                  </button>
                ))}
              </div>
              {selectedGame && <GameDetail game={selectedGame} />}
            </>
          )}
        </section>

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          🍺 May the best drinker win. Drink responsibly.
        </footer>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: Game["status"] }) {
  const label = {
    upcoming: "Upcoming",
    group_stage: "Group",
    playoffs: "Playoffs",
    completed: "Done",
  }[status];
  const cls = {
    upcoming: "bg-muted text-muted-foreground",
    group_stage: "bg-primary/20 text-primary",
    playoffs: "bg-destructive/20 text-destructive",
    completed: "bg-foreground/10 text-foreground/80",
  }[status];
  return <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider", cls)}>{label}</span>;
}

function GameDetail({ game }: { game: Game }) {
  const { data } = useQuery({ queryKey: ["beerlympics"], queryFn: fetchAll });
  if (!data) return null;
  const standings = computeGameStandings(game, data.participants, data.timeResults, data.h2hMatches);
  const pmap = new Map(data.participants.map((p) => [p.id, p]));

  return (
    <div className="rounded-xl border border-border bg-card card-elev p-5 animate-pop">
      <h3 className="mb-4 font-display text-2xl text-foreground">{game.name}</h3>

      {game.scoring_type === "time" ? (
        <div className="space-y-2">
          {standings.length === 0 && <p className="text-sm text-muted-foreground">No times posted yet.</p>}
          {standings.map((s) => {
            const tr = data.timeResults.find((t) => t.game_id === game.id && t.participant_id === s.participant.id);
            return (
              <div key={s.participant.id} className={cn("flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3", s.rank <= 3 && "border-primary/40")}>
                <div className="flex items-center gap-3">
                  <span className="w-6 font-display text-xl">{s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : s.rank}</span>
                  <span className="inline-block h-6 w-6 rounded-full" style={{ background: s.participant.color }} />
                  <span className="font-semibold">{s.participant.name}</span>
                </div>
                <span className="font-display text-xl gold-text">{tr ? formatTime(tr.time_seconds) : "—"}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <H2HView game={game} pmap={pmap} matches={data.h2hMatches} groups={data.groups} />
      )}

      {standings.length > 0 && game.status !== "completed" && (
        <p className="mt-4 text-xs text-muted-foreground">Points: 🥇 {game.points_first} · 🥈 {game.points_second} · 🥉 {game.points_third}</p>
      )}
    </div>
  );
}

function H2HView({
  game, pmap, matches, groups,
}: {
  game: Game;
  pmap: Map<string, import("@/lib/beerlympics").Participant>;
  matches: import("@/lib/beerlympics").H2HMatch[];
  groups: import("@/lib/beerlympics").ParticipantGroup[];
}) {
  const groupStandings = computeGroupStandings(game, matches);
  const groupA = groupStandings.filter((s) => groups.find((g) => g.game_id === game.id && g.participant_id === s.participant_id)?.group_name === "A");
  const groupB = groupStandings.filter((s) => groups.find((g) => g.game_id === game.id && g.participant_id === s.participant_id)?.group_name === "B");

  const playoff = matches.filter((m) => m.game_id === game.id && m.stage === "playoff");
  const sf1 = playoff.find((m) => m.bracket_slot === "SF1");
  const sf2 = playoff.find((m) => m.bracket_slot === "SF2");
  const finalM = playoff.find((m) => m.bracket_slot === "FINAL");
  const thirdM = playoff.find((m) => m.bracket_slot === "THIRD");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {[{ label: "Group A", rows: groupA }, { label: "Group B", rows: groupB }].map((g) => (
          <div key={g.label}>
            <h4 className="mb-2 font-display text-xl text-primary">{g.label}</h4>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Player</th><th className="px-2 py-2">P</th><th className="px-2 py-2">W</th><th className="px-2 py-2">L</th><th className="px-2 py-2">Pts</th></tr>
                </thead>
                <tbody>
                  {g.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-muted-foreground">No data</td></tr>}
                  {g.rows.map((row) => {
                    const p = pmap.get(row.participant_id);
                    if (!p) return null;
                    return (
                      <tr key={row.participant_id} className="border-t border-border">
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-2 py-2 text-center">{row.played}</td>
                        <td className="px-2 py-2 text-center text-primary">{row.won}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{row.lost}</td>
                        <td className="px-2 py-2 text-center font-bold">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {(game.status === "playoffs" || game.status === "completed") && (
        <div>
          <h4 className="mb-3 font-display text-xl text-primary">Playoff Bracket</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-3">
              <BracketCard title="SF1" match={sf1} pmap={pmap} />
              <BracketCard title="SF2" match={sf2} pmap={pmap} />
            </div>
            <div className="flex items-center"><BracketCard title="Final" match={finalM} pmap={pmap} big /></div>
            <BracketCard title="3rd Place" match={thirdM} pmap={pmap} />
          </div>
        </div>
      )}

      {game.scoring_type === "h2h" && matches.filter((m) => m.game_id === game.id && m.stage === "group").length > 0 && (
        <div>
          <h4 className="mb-2 font-display text-xl text-primary">Group Matches</h4>
          <div className="space-y-2">
            {matches.filter((m) => m.game_id === game.id && m.stage === "group").map((m) => {
              const a = m.participant_a ? pmap.get(m.participant_a) : null;
              const b = m.participant_b ? pmap.get(m.participant_b) : null;
              return (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
                  <span className={cn("flex-1", m.winner_id === m.participant_a && "font-bold text-primary")}>{a?.name ?? "?"}</span>
                  <span className="mx-3 font-mono text-muted-foreground">{m.score_a ?? "-"} : {m.score_b ?? "-"}</span>
                  <span className={cn("flex-1 text-right", m.winner_id === m.participant_b && "font-bold text-primary")}>{b?.name ?? "?"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BracketCard({
  title, match, pmap, big,
}: {
  title: string;
  match?: import("@/lib/beerlympics").H2HMatch;
  pmap: Map<string, import("@/lib/beerlympics").Participant>;
  big?: boolean;
}) {
  const a = match?.participant_a ? pmap.get(match.participant_a) : null;
  const b = match?.participant_b ? pmap.get(match.participant_b) : null;
  return (
    <div className={cn("rounded-lg border border-border bg-background/50 p-3", big && "border-primary/60 glow")}>
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className={cn("flex items-center justify-between text-sm", match?.winner_id === match?.participant_a && "font-bold text-primary")}>
        <span>{a?.name ?? "TBD"}</span>
        <span className="font-mono">{match?.score_a ?? "-"}</span>
      </div>
      <div className={cn("mt-1 flex items-center justify-between text-sm", match?.winner_id === match?.participant_b && "font-bold text-primary")}>
        <span>{b?.name ?? "TBD"}</span>
        <span className="font-mono">{match?.score_b ?? "-"}</span>
      </div>
    </div>
  );
}
