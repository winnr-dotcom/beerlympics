-- Run once in Supabase SQL editor to set correct game types
-- https://supabase.com/dashboard/project/gqdeidsgimsighzlnfne/sql/new

UPDATE bl_games SET game_type = 'individual_race'   WHERE name = 'Hinderløypen';
UPDATE bl_games SET game_type = 'lives_no_playoff'  WHERE name = 'Slap Cup';
