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
