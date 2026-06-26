-- ============================================================
-- BEERLYMPICS 2024 — Database Migration
-- Run this in: https://supabase.com/dashboard/project/mysqfdukeqiewdgtlvvv/sql/new
-- ============================================================

-- New tables (old ones stay, just unused)

create table if not exists contestants (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  nickname   text,
  pin_code   text not null unique,
  photo_url  text,
  created_at timestamptz not null default now()
);

create table if not exists bl_games (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0
);

create table if not exists round1_results (
  id             uuid  primary key default gen_random_uuid(),
  contestant_id  uuid  not null references contestants(id) on delete cascade,
  game_id        uuid  not null references bl_games(id)   on delete cascade,
  time_seconds   float not null,
  updated_at     timestamptz not null default now(),
  unique(contestant_id, game_id)
);

create table if not exists round2_results (
  id             uuid  primary key default gen_random_uuid(),
  contestant_id  uuid  not null references contestants(id) on delete cascade,
  game_id        uuid  not null references bl_games(id)   on delete cascade,
  time_seconds   float not null,
  updated_at     timestamptz not null default now(),
  unique(contestant_id, game_id)
);

create table if not exists bonus_points (
  id             uuid primary key default gen_random_uuid(),
  contestant_id  uuid not null references contestants(id) on delete cascade,
  points         int  not null,
  reason         text,
  created_at     timestamptz not null default now()
);

-- RLS (public read + write — frontend-controlled security)
alter table contestants    enable row level security;
alter table bl_games       enable row level security;
alter table round1_results enable row level security;
alter table round2_results enable row level security;
alter table bonus_points   enable row level security;

create policy "all" on contestants    for all using (true) with check (true);
create policy "all" on bl_games       for all using (true) with check (true);
create policy "all" on round1_results for all using (true) with check (true);
create policy "all" on round2_results for all using (true) with check (true);
create policy "all" on bonus_points   for all using (true) with check (true);

-- Games
insert into bl_games (name, sort_order) values
  ('Hinderløypen', 0),
  ('Can Baseball',  1),
  ('Popp Koppen',   2),
  ('Labyrinten',    3),
  ('Foot-Tennis',   4),
  ('Crock it',      5),
  ('Chessboard',    6),
  ('Slap Cup',      7)
on conflict do nothing;

-- Contestants + PIN codes
insert into contestants (full_name, pin_code) values
  ('Torjer Meling',     '1847'),
  ('Tomas Wereide',     '2953'),
  ('Konstantin Jordal', '3619'),
  ('Emil Tolås',        '4728'),
  ('Bo Naversen',       '5364'),
  ('Lasse Drage',       '6091'),
  ('Eirik Vadla',       '7582'),
  ('Markus Holt',       '8416'),
  ('Per Omvik',         '9273'),
  ('Mads Lindhardsen',  '1638'),
  ('Steffen Hensman',   '2749')
on conflict do nothing;

-- ============================================================
-- STORAGE BUCKET (do this in Supabase dashboard, not SQL):
-- Dashboard → Storage → New bucket
-- Name: avatars
-- Public: YES (toggle on)
-- ============================================================
