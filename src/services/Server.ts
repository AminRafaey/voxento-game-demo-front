import { Client, Room } from "colyseus.js";

export default class Server {
  client: Client;
  room: Room | null = null;

  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async join() {
    try {
      this.room = await this.client.joinOrCreate("game_room");
      console.log("✅ Connected to multiplayer room:", this.room.roomId);
      return this.room;
    } catch (error) {
      console.error("❌ Failed to join room:", error);
      throw error;
    }
  }

  leave() {
    if (this.room) {
      this.room.leave();
      this.room = null;
      console.log("Disconnected from multiplayer");
    }
  }
}
