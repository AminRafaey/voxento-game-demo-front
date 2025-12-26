// Type definitions matching backend schema
export interface Player {
  x: number;
  y: number;
  animation: string;
  flipX: boolean;
  tint: number;
  maxHealth: number;
  health: number;
  finished: boolean;
  finishRank: number;
  result: string;
  score: number;
}

export interface Coin {
  x: number;
  y: number;
  variant: string;
  healPercent: number;
}

export interface MyRoomState {
  players: Map<string, Player>;
  coins: Map<string, Coin>;
  gameStarted: boolean;
  gameEnded: boolean;
  adminId: string;
  countdown: number;
}
