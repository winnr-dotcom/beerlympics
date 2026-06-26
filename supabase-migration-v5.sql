-- ============================================================
-- BEERLYMPICS — Migration v5: Popp Koppen time-based scoring
-- Run in: https://supabase.com/dashboard/project/gqdeidsgimsighzlnfne/sql/new
-- Run AFTER v1 + v2 + v3 + v4
-- ============================================================

-- Add R1 and playoff time columns to team_game_rankings
alter table team_game_rankings add column if not exists r1_time_seconds float;
alter table team_game_rankings add column if not exists playoff_time_seconds float;
