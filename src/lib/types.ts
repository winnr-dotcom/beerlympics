export type Contestant = {
  id: string;
  full_name: string;
  nickname: string | null;
  pin_code: string;
  photo_url: string | null;
  created_at: string;
};

export type GameType =
  | "individual"        // time-based, lower is better (Hinderløypen, Labyrinten)
  | "individual_points" // points, higher is better (Can Baseball)
  | "lives_bracket"     // lives elimination then bracket (Foot-Tennis, Slap Cup)
  | "cup_format"        // group stage + knockout (Crock it)
  | "team_popp"         // team time game (Popp Koppen)
  | "team_chess";       // team league game (Chessboard)

export type BLGame = {
  id: string;
  name: string;
  sort_order: number;
  game_type: GameType;
};

export type Round1Result = {
  id: string;
  contestant_id: string;
  game_id: string;
  time_seconds: number; // also used for "points" in individual_points games
  updated_at: string;
};

export type Round2Result = {
  id: string;
  contestant_id: string;
  game_id: string;
  time_seconds: number;
  updated_at: string;
};

export type BonusPoint = {
  id: string;
  contestant_id: string;
  points: number;
  reason: string | null;
  created_at: string;
};

export type TeamGamePlayer = {
  id: string;
  game_id: string;
  contestant_id: string;
  team_number: number;
  is_displaced: boolean;
  created_at: string;
};

export type TeamGameRanking = {
  id: string;
  game_id: string;
  team_number: number;
  rank: number | null;
  tiebreak_winner_id: string | null;
  updated_at: string;
};

export type ChessboardMatch = {
  id: string;
  game_id: string;
  team_a: number;
  team_b: number;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_team: number | null; // 0=draw, 1=team_a, 2=team_b, null=not played
  score_a: number | null;
  score_b: number | null;
  updated_at: string;
};

export type LivesGameState = {
  id: string;
  game_id: string;
  contestant_id: string;
  initial_lives: number;
  current_lives: number;
  eliminated_order: number | null; // 1=first out=last place
  updated_at: string;
};

export type CrockGroup = {
  id: string;
  game_id: string;
  contestant_id: string;
  group_number: number; // 1-4 initial, 5=wildcard
  time_seconds: number | null;
  advances: boolean | null;
  updated_at: string;
};

export type GameResult = {
  points: number | null;
  isProvisional: boolean;
  rank: number | null;
};

export type LeaderboardRow = {
  contestant: Contestant;
  gameResults: Record<string, GameResult>;
  bonusTotal: number;
  total: number;
  rank: number;
};
