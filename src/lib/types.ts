export type Contestant = {
  id: string;
  full_name: string;
  nickname: string | null;
  pin_code: string;
  photo_url: string | null;
  created_at: string;
};

export type BLGame = {
  id: string;
  name: string;
  sort_order: number;
  game_type: "individual" | "team_popp" | "team_chess";
};

export type Round1Result = {
  id: string;
  contestant_id: string;
  game_id: string;
  time_seconds: number;
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
  winner_team: number | null;
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
