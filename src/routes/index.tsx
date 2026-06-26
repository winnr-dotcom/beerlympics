import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAll, type FetchAllResult } from "@/lib/api";
import { computeLeaderboard, formatTime, getBrackets } from "@/lib/scoring";
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

function LeaderboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["beerlympics"],
    queryFn: fetchAll,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const rows = data
    ? computeLeaderboard(data.contestants, data.games, data.round1, data.round2, data.bonuses)
    : [];

  const hasAnyResult = (data?.round1.length ?? 0) > 0;
  const bracketGames = data?.games.filter((g) => (data.round1.filter((r) => r.game_id === g.id).length) >= 6) ?? [];

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
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/30">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/70">
                    <th className="w-10 px-3 py-3.5 text-left text-zinc-500 font-medium">#</th>
                    <th className="px-3 py-3.5 text-left text-zinc-300 font-semibold min-w-[130px]">Player</th>
                    {data.games.map((g) => (
                      <th
                        key={g.id}
                        className="px-2 py-3.5 text-center text-xs font-semibold text-zinc-400 whitespace-nowrap"
                        title={g.name}
                      >
                        {SHORT[g.name] ?? g.name.substring(0, 5).toUpperCase()}
                      </th>
                    ))}
                    <th className="px-2 py-3.5 text-center text-xs font-semibold text-zinc-400">+/−</th>
                    <th className="px-3 py-3.5 text-center text-sm font-black text-amber-400 min-w-[60px]">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.contestant.id}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                        idx === 0
                          ? "bg-amber-950/30"
                          : idx === 1
                          ? "bg-zinc-800/20"
                          : idx === 2
                          ? "bg-orange-950/20"
                          : ""
                      }`}
                    >
                      <td className="w-10 px-3 py-3">
                        <RankBadge rank={row.rank} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={row.contestant.nickname ?? row.contestant.full_name}
                            photo_url={row.contestant.photo_url}
                          />
                          <span className="font-medium text-white">
                            {row.contestant.nickname ?? row.contestant.full_name.split(" ")[0]}
                          </span>
                        </div>
                      </td>
                      {data.games.map((g) => (
                        <GameCell key={g.id} row={row} gameId={g.id} />
                      ))}
                      <td className="px-2 py-3 text-center text-sm">
                        <span
                          className={
                            row.bonusTotal > 0
                              ? "font-semibold text-green-400"
                              : row.bonusTotal < 0
                              ? "font-semibold text-red-400"
                              : "text-zinc-700"
                          }
                        >
                          {row.bonusTotal > 0
                            ? `+${row.bonusTotal}`
                            : row.bonusTotal < 0
                            ? row.bonusTotal
                            : "–"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-lg font-black text-amber-400 tabular-nums">{row.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Game status cards */}
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Games</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {data.games.map((g) => {
                  const r1c = data.round1.filter((r) => r.game_id === g.id).length;
                  const r2c = data.round2.filter((r) => r.game_id === g.id).length;
                  const done = r2c >= 11;
                  const playoffs = r2c > 0;
                  const r1done = r1c >= 11;
                  const active = r1c > 0 && r1c < 11;
                  return (
                    <div
                      key={g.id}
                      className={`rounded-lg border px-3 py-2 text-center ${
                        done
                          ? "border-green-800 bg-green-950/30"
                          : playoffs
                          ? "border-amber-800 bg-amber-950/30"
                          : r1done
                          ? "border-blue-800 bg-blue-950/20"
                          : active
                          ? "border-yellow-800 bg-yellow-950/20"
                          : "border-zinc-800"
                      }`}
                    >
                      <div className="text-xs font-semibold text-zinc-300 truncate">{g.name}</div>
                      <div className={`mt-0.5 text-[10px] ${done ? "text-green-400" : playoffs ? "text-amber-400" : r1done ? "text-blue-400" : active ? "text-yellow-400" : "text-zinc-600"}`}>
                        {done ? "✓ Done" : playoffs ? "Playoffs" : r1done ? "R1 Done" : active ? `R1 ${r1c}/11` : "Upcoming"}
                      </div>
                    </div>
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
    </div>
  );
}
