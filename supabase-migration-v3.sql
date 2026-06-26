-- ============================================================
-- BEERLYMPICS — Migration v3: Extended game formats
-- Run in: https://supabase.com/dashboard/project/mysqfdukeqiewdgtlvvv/sql/new
-- Run AFTER v1 + v2 (or run all three in order)
-- ============================================================

-- 1. Extended game_type values for new formats
alter table bl_games add column if not exists game_type text not null default 'individual';
update bl_games set game_type = 'individual_points' where name = 'Can Baseball';
update bl_games set game_type = 'lives_bracket'     where name in ('Foot-Tennis', 'Slap Cup');
update bl_games set game_type = 'cup_format'        where name = 'Crock it';
-- Popp Koppen + Chessboard already set to team_popp / team_chess by v2
-- Hinderløypen + Labyrinten stay as 'individual' (time, lower is better)

-- 2. Lives tracking (Foot Tennis, Slap Cup)
create table if not exists lives_game_state (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references bl_games(id) on delete cascade,
  contestant_id   uuid not null references contestants(id) on delete cascade,
  initial_lives   int  not null default 3,
  current_lives   int  not null default 3,
  eliminated_order int,   -- 1 = first eliminated (= last place), null = still alive
  updated_at      timestamptz not null default now(),
  unique(game_id, contestant_id)
);
alter table lives_game_state enable row level security;
drop policy if exists "lives_all" on lives_game_state;
create policy "lives_all" on lives_game_state for all using (true) with check (true);

-- 3. Crock it — group stage
create table if not exists crock_groups (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references bl_games(id) on delete cascade,
  contestant_id uuid not null references contestants(id) on delete cascade,
  group_number  int  not null,   -- 1-4 = initial groups, 5 = wildcard round
  time_seconds  float,           -- their time in the group round
  advances      boolean,         -- admin/system marks who advances to knockout
  updated_at    timestamptz not null default now(),
  unique(game_id, contestant_id)
);
alter table crock_groups enable row level security;
drop policy if exists "crock_all" on crock_groups;
create policy "crock_all" on crock_groups for all using (true) with check (true);

-- 4. Chessboard — add scores to matches
alter table chessboard_matches add column if not exists score_a int;
alter table chessboard_matches add column if not exists score_b int;
-- winner_team: 1 = team_a wins, 2 = team_b wins, 0 = draw, null = not played
