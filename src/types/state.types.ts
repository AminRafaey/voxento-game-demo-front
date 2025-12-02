// Type definitions matching backend schema
export interface Player {
  x: number;
  y: number;
  animation: string;
  flipX: boolean;
  tint: number;
  health: number;
  maxHealth: number;
}

export interface MyRoomState {
  players: Map<string, Player>;
}
