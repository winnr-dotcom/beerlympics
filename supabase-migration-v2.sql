-- ============================================================
-- BEERLYMPICS 2024 — Migration v2 (team games)
-- Run AFTER supabase-migration.sql in Supabase SQL Editor
-- ============================================================

-- Add game_type to bl_games
alter table bl_games add column if not exists game_type text not null default 'individual';
update bl_games set game_type = 'team_popp'  where name = 'Popp Koppen';
update bl_games set game_type = 'team_chess' where name = 'Chessboard';

-- Team assignments (who is on which team for a given game)
create table if not exists team_game_players (
  id             uuid    primary key default gen_random_uuid(),
  game_id        uuid    not null references bl_games(id) on delete cascade,
  contestant_id  uuid    not null references contestants(id) on delete cascade,
  team_number    int     not null,
  is_displaced   bool    not null default false,
  created_at     timestamptz not null default now(),
  unique(game_id, contestant_id)
);

-- Team rankings + intra-team tiebreaker winner
create table if not exists team_game_rankings (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references bl_games(id) on delete cascade,
  team_number         int  not null,
  rank                int,
  tiebreak_winner_id  uuid references contestants(id),
  updated_at          timestamptz not null default now(),
  unique(game_id, team_number)
);

-- Chessboard league matches
create table if not exists chessboard_matches (
  id            uuid  primary key default gen_random_uuid(),
  game_id       uuid  not null references bl_games(id) on delete cascade,
  team_a        int   not null,
  team_b        int   not null,
  player_a_id   uuid  references contestants(id),
  player_b_id   uuid  references contestants(id),
  winner_team   int   check (winner_team in (1, 2)),
  updated_at    timestamptz not null default now(),
  unique(game_id, team_a, team_b)
);

-- RLS
alter table team_game_players  enable row level security;
alter table team_game_rankings enable row level security;
alter table chessboard_matches enable row level security;

create policy "all" on team_game_players  for all using (true) with check (true);
create policy "all" on team_game_rankings for all using (true) with check (true);
create policy "all" on chessboard_matches for all using (true) with check (true);
