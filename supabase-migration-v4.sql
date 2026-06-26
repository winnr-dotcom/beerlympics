-- ============================================================
-- BEERLYMPICS — Migration v4: Crock it multi-round + Lives bottom bracket
-- Run in: https://supabase.com/dashboard/project/gqdeidsgimsighzlnfne/sql/new
-- Run AFTER v1 + v2 + v3
-- ============================================================

-- 1. Add stage column to crock_groups (distinguishes R1 vs R2 group stage)
alter table crock_groups add column if not exists stage text not null default 'r1';

-- 2. Drop old unique constraint (contestant in only one group total)
--    Replace with one that allows wildcard (same player in A/B + D in R1)
alter table crock_groups drop constraint if exists crock_groups_game_id_contestant_id_key;
alter table crock_groups add constraint if not exists crock_groups_game_id_contestant_id_group_number_stage_key
  unique(game_id, contestant_id, group_number, stage);

-- 3. Create crock_finals for Final + Consolation round time entries
create table if not exists crock_finals (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references bl_games(id) on delete cascade,
  contestant_id uuid not null references contestants(id) on delete cascade,
  stage         text not null,     -- 'final', 'consol_r2', 'consol_r1'
  time_seconds  float,
  updated_at    timestamptz not null default now(),
  unique(game_id, contestant_id, stage)
);
alter table crock_finals enable row level security;
drop policy if exists "crock_finals_all" on crock_finals;
create policy "crock_finals_all" on crock_finals for all using (true) with check (true);
