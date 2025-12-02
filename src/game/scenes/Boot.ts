import { Scene } from "phaser";
import Server from "../../services/Server";

export class Boot extends Scene {
  private server!: Server;

  constructor() {
    super("Boot");
  }

  preload() {
    // Initialize server for multiplayer
    this.server = new Server();

    this.load.setPath("/assets/");

    this.load.image("background", "bg.png");
    // this.load.image("background", "space-stars.jpg");
    this.load.atlas("sprite", "sprite.png", "sprite.json");

    this.load.image("tiles", "tilesheet.png");
    this.load.tilemapTiledJSON("tilemap", "long_map.json");

    this.load.spritesheet("coin-gold", "coin-gold.png", {
      frameWidth: 16,
      frameHeight: 16,
    });

    this.load.spritesheet("coin-red", "coin-red.png", {
      frameWidth: 16,
      frameHeight: 16,
    });

    // audio
    this.load.audio("bg_music", "music/bg_music.mp3");
  }

  create() {
    // Pass server to MainMenu scene
    this.scene.start("MainMenu", { server: this.server });
  }
}
