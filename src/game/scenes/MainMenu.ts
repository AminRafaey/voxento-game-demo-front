import { Scene } from "phaser";
import Server from "../../services/Server";
import { Room, getStateCallbacks } from "colyseus.js";
import { MyRoomState, Player } from "../../types/state.types";
import { modalManager } from "../../utils/modalManager";
import { modalCallbacks } from "../../components/GameModalsContainer";
import RemotePlayerManager from "../components/RemotePlayerManager";
import NameLabel from "../components/NameLabel";
import LocalHealthController from "../components/LocalHealthController";
import {
  createCoinPickupHandler,
  registerCoinAnimations,
} from "./helpers/coinHelpers";
import {
  registerQuizEventListeners,
  unregisterQuizEventListeners,
  type QuizEventBindings,
} from "./helpers/quizEventHelpers";
import { CloudManager } from "./helpers/cloudHelpers";
import { StarfieldManager } from "./helpers/starfieldHelpers";
import { QUIZ_AVAILABILITY_CHANGED } from "../../quiz/events";

const MSG_GAME_START = "GAME_START";
const MSG_TIMER_UPDATE = "TIMER_UPDATE";
const MSG_GAME_RESULTS = "GAME_RESULTS";
const MSG_START_GAME = "start-game";
const MSG_PLAYER_FINISHED = "player-finished";

interface GameResultsPayload {
  winnerId: string | null;
  rankings: Array<{
    sessionId: string;
    rank: number;
    result: string;
  }>;
  timeExpired: boolean;
}

export class MainMenu extends Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private jumpCount: number = 0;
  private maxJumps: number = 2;

  // Multiplayer properties
  private server!: Server;
  private room!: Room<MyRoomState>;
  private remotePlayers!: RemotePlayerManager;
  private playerCountText!: Phaser.GameObjects.Text;
  private playerHealthText!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private playerLabel?: NameLabel;
  private playerTint: number = 0xffffff;
  private bgMusic?: Phaser.Sound.BaseSound;
  private musicButton?: Phaser.GameObjects.Text;
  private coins!: Phaser.Physics.Arcade.Group;
  private coinOverlap?: Phaser.Physics.Arcade.Collider;
  private handleCoinPickup!: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;
  private readonly defaultMusicVolume = 0.3;
  private lastSnapshotSentAt = 0;
  private healthController!: LocalHealthController;
  private readonly snapshotInterval = 50; // milliseconds between state syncs
  private readonly remoteLerpDuration = 120; // milliseconds to interpolate remote players
  private quizActive = false;
  private quizEventHandlers?: QuizEventBindings;
  private quizAvailable = false;
  private cloudManager?: CloudManager;
  private starfield?: StarfieldManager;
  private countdownText?: Phaser.GameObjects.Text;
  private countdownSeconds = 0;
  private readonly gameDurationSeconds = 60;
  private isAdmin = false;
  private gameStarted = false;
  private gameEnded = false;
  private finishLineX = 0;
  private finishLine?: Phaser.GameObjects.Rectangle;
  private finishReported = false;
  private localSessionId = "";
  private lastLobbyUpdateTime = 0;
  private readonly LOBBY_UPDATE_INTERVAL = 500; // Update lobby every 500ms

  // Game state enum for better state management
  private get gameState(): "connecting" | "lobby" | "playing" | "finished" {
    if (!this.room) return "connecting";
    if (this.gameEnded) return "finished";
    if (this.gameStarted) return "playing";
    return "lobby";
  }

  constructor() {
    super("MainMenu");
  }

  init(data: { server: Server }) {
    this.server = data.server;
  }

  async create() {
    // Create tilemap
    this.map = this.make.tilemap({ key: "tilemap" });
    // Phaser renames tilesets internally - using the first tileset by index
    const tileset = this.map.tilesets[0]
      ? this.map.addTilesetImage(
          this.map.tilesets[0].name, // Use the actual tileset name from Phaser
          "tiles" // key of the loaded image
        )
      : null;

    const mapWidth = this.map.widthInPixels;
    this.updateQuizAvailability(false);
    const mapHeight = this.map.heightInPixels;

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

    // Add background
    const bg = this.add.image(mapWidth / 2, mapHeight / 2, "background");
    bg.setDisplaySize(mapWidth, mapHeight);
    bg.setScrollFactor(1);
    bg.setDepth(0);

    this.finishLineX = Math.max(
      128,
      mapWidth - Math.max(this.map.tileWidth || 32, 32) * 4
    );

    this.starfield = new StarfieldManager(this, mapWidth, mapHeight);
    this.starfield.create({
      textureKey: "star",
      count: 140,
      minSpeed: 6,
      maxSpeed: 12,
      minScale: 0.2,
      maxScale: 0.6,
      minAlpha: 0.25,
      maxAlpha: 0.7,
      depth: 0.5,
      scrollFactor: 0.18,
      yRange: [mapHeight * 0.05, mapHeight * 0.4],
    });

    this.cloudManager = new CloudManager(this, mapWidth, mapHeight);
    this.cloudManager.createLayer({
      textureKey: "clouds",
      count: 6,
      minSpeed: 6,
      maxSpeed: 12,
      minScale: 0.6,
      maxScale: 0.9,
      scrollFactor: 0.22,
      depth: 1,
      yRange: [mapHeight * 0.08, mapHeight * 0.24],
    });
    this.cloudManager.createLayer({
      textureKey: "clouds",
      count: 8,

      minSpeed: 18,
      maxSpeed: 28,
      minScale: 0.9,
      maxScale: 1.3,
      scrollFactor: 0.35,
      depth: 2,
      yRange: [mapHeight * 0.12, mapHeight * 0.32],
    });
    this.cloudManager.createLayer({
      textureKey: "clouds",
      count: 5,
      minSpeed: 32,
      maxSpeed: 48,
      minScale: 1.2,
      maxScale: 1.7,
      scrollFactor: 0.52,
      depth: 3,
      yRange: [mapHeight * 0.18, mapHeight * 0.38],
    });

    this.finishLine = this.add.rectangle(
      this.finishLineX,
      mapHeight / 2,
      6,
      mapHeight,
      0xffd166,
      0.35
    );
    this.finishLine.setDepth(6);
    this.finishLine.setScrollFactor(1);

    // Create ground layer (using correct layer name from new_game.json)
    if (tileset) {
      this.groundLayer = this.map.createLayer("ground", tileset, 0, 0)!;
      // Note: JSON has typo "colides" instead of "collides"
      this.groundLayer.setCollisionByProperty({ Custome_Collide: true });
      this.groundLayer.setDepth(5);
    }

    // Create shadow
    this.shadow = this.add.ellipse(100, 330, 40, 12, 0x000000, 0.4);
    this.shadow.setDepth(9);

    // Create player sprite
    this.player = this.physics.add.sprite(100, 300, "sprite", "sprite_idle");
    this.player.setScale(0.6);
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Create animations
    this.anims.create({
      key: "idle",
      frames: [{ key: "sprite", frame: "sprite_idle" }],
      frameRate: 1,
    });

    this.anims.create({
      key: "walk",
      frames: [
        { key: "sprite", frame: "sprite_walk01" },
        { key: "sprite", frame: "sprite_walk02" },
        { key: "sprite", frame: "sprite_walk03" },
      ],
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: "jump",
      frames: [{ key: "sprite", frame: "sprite_jump" }],
      frameRate: 1,
    });

    this.player.play("idle");

    // Setup collision
    if (this.groundLayer) {
      this.physics.add.collider(this.player, this.groundLayer);
    }

    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // Camera setup
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setZoom(1);

    // Create player count text (fixed to camera, top-left)
    this.playerCountText = this.add.text(16, 16, "Players joined: 0", {
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 10, y: 5 },
    });
    this.playerCountText.setScrollFactor(0);
    this.playerCountText.setDepth(1000);

    // Create player health text (fixed to camera, top-right)
    this.playerHealthText = this.add.text(0, 0, "Health: 1000%", {
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 10, y: 5 },
    });
    this.playerHealthText.setScrollFactor(0);
    this.playerHealthText.setDepth(1000);
    this.playerHealthText.setOrigin(1, 0);
    this.playerHealthText.setPosition(this.cameras.main.width - 16, 16);

    // Create player score text (fixed to camera, top-right, below health)
    this.playerScoreText = this.add.text(0, 0, "Score: 0", {
      fontSize: "20px",
      color: "#FFD700",
      backgroundColor: "#000000",
      padding: { x: 10, y: 5 },
    });
    this.playerScoreText.setScrollFactor(0);
    this.playerScoreText.setDepth(1000);
    this.playerScoreText.setOrigin(1, 0);
    this.playerScoreText.setPosition(this.cameras.main.width - 16, 50);

    this.healthController = new LocalHealthController(this, {
      healthText: this.playerHealthText,
      moveCost: 2,
      moveCostInterval: 250,
    });

    this.quizEventHandlers = registerQuizEventListeners({
      onOpened: () => {
        this.quizActive = true;
      },
      onClosed: () => {
        this.quizActive = false;
      },
      onAnswered: (event) => {
        if (event.detail?.correct) {
          this.healthController.addHealth(10);
        }
      },
    });

    registerCoinAnimations(this);

    this.coins = this.physics.add.group({
      allowGravity: false,
      immovable: true,
      classType: Phaser.Physics.Arcade.Sprite,
    });

    // Coins will be populated from server state, not locally
    // Remove the local populateCoins call

    this.handleCoinPickup = createCoinPickupHandler(
      this,
      this.healthController,
      (coinId: string) => {
        // Immediately remove coin client-side for instant feedback
        this.handleCoinRemove(coinId);

        // Send coin collection to server
        if (this.room) {
          this.room.send("collect-coin", { coinId });
        }
      }
    );

    this.coinOverlap = this.physics.add.overlap(
      this.player,
      this.coins,
      this.handleCoinPickup,
      undefined,
      this
    );

    // Initialize multiplayer helpers
    this.remotePlayers = new RemotePlayerManager(this, {
      interpolationDuration: this.remoteLerpDuration,
      formatSessionId: (sessionId: string) => this.formatSessionId(sessionId),
    });

    // Show loading modal
    modalManager.showLoading("Connecting to server...");

    // Setup modal callbacks
    modalCallbacks.onStartGame = () => this.requestStartGame();
    modalCallbacks.onCloseResults = () => {
      this.gameEnded = false;
      this.finishReported = false;
    };

    this.bgMusic = this.sound.add("bg_music", {
      loop: true,
      volume: this.defaultMusicVolume,
    });

    if (this.sound.locked) {
      this.sound.once("unlocked", () => {
        this.bgMusic?.play();
      });
    } else {
      this.bgMusic.play();
    }

    this.musicButton = this.add.text(this.scale.width - 16, 16, "🔊", {
      fontSize: "24px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    });
    this.musicButton.setDepth(1001);
    this.musicButton.setOrigin(1, 0);
    this.musicButton.setScrollFactor(0);
    this.musicButton
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.toggleMusic();
      })
      .on("pointerover", () => this.musicButton?.setAlpha(0.8))
      .on("pointerout", () => this.musicButton?.setAlpha(1));

    this.createCountdownDisplay();

    await this.connect();
  }

  private toggleMusic() {
    this.bgMusic?.isPlaying ? this.bgMusic?.stop() : this.bgMusic?.play();
    this.musicButton?.setText(!this.bgMusic?.isPlaying ? "🔈" : "🔊");
  }

  private async connect() {
    if (!this.server) {
      console.warn("⚠️ Server not initialized");
      return;
    }

    try {
      this.room = await this.server.join();
      this.healthController.setRoom(this.room);
      const mySessionId = this.room.sessionId;
      this.localSessionId = mySessionId;

      modalManager.updateLoadingMessage("Joined room. Waiting for spawn...");

      console.log("🎮 Connected - Session:", mySessionId);

      // Use getStateCallbacks for proper state synchronization
      const $ = getStateCallbacks(this.room);

      this.room.onMessage(MSG_GAME_START, (payload: { countdown?: number }) => {
        this.handleGameStartMessage(payload);
      });

      this.room.onMessage(
        MSG_TIMER_UPDATE,
        (payload: { countdown?: number }) => {
          if (typeof payload?.countdown === "number") {
            this.updateCountdown(payload.countdown);
          }
        }
      );

      this.room.onMessage(MSG_GAME_RESULTS, (payload: GameResultsPayload) => {
        this.handleGameResults(payload);
      });

      this.isAdmin = this.room.state.adminId === mySessionId;
      this.gameStarted = !!this.room.state.gameStarted;
      this.gameEnded = !!this.room.state.gameEnded;
      this.countdownSeconds =
        typeof this.room.state.countdown === "number"
          ? this.room.state.countdown
          : 0;

      this.updateCountdownDisplay();
      this.updateLobbyOverlay();
      this.updateQuizAvailability(this.gameStarted && !this.gameEnded);

      const stateWithListener = this.room.state as unknown as {
        onChange?: (
          handler: (changes: Array<{ field: string; value: unknown }>) => void
        ) => void;
      };

      stateWithListener.onChange?.(
        (changes: Array<{ field: string; value: unknown }>) => {
          changes.forEach((change) => {
            switch (change.field) {
              case "adminId":
                this.handleAdminChange(change.value as string, mySessionId);
                break;
              case "gameStarted":
                this.handleGameStartedChange(!!change.value);
                break;
              case "gameEnded":
                this.handleGameEndedChange(!!change.value);
                break;
              case "countdown":
                this.updateCountdown(
                  typeof change.value === "number" ? change.value : 0
                );
                break;
              default:
                break;
            }
          });
        }
      );

      // Listen for players being added
      $(this.room.state).players.onAdd((player: any, sessionId: string) => {
        // Update player count
        this.updatePlayerCount();

        if (sessionId === mySessionId) {
          console.log("👤 Local player initialized");
          this.handleLocalPlayerAdd(player as Player, mySessionId);
          $(player).onChange(() => {
            this.healthController.applyState(player as Player);
          });
          return;
        }

        console.log("👥 Remote player joined:", sessionId);
        this.remotePlayers.add(sessionId, player as Player);

        $(player).onChange(() => {
          this.remotePlayers.applyState(sessionId, player as Player);
        });
      });

      // Remove local reference when entity is removed from the server
      $(this.room.state).players.onRemove((_player: any, sessionId: string) => {
        this.remotePlayers.remove(sessionId);
        console.log("👋 Player left:", sessionId);
        this.updatePlayerCount();
      });

      // Listen for coins being added
      $(this.room.state).coins.onAdd((coin: any, coinId: string) => {
        this.handleCoinAdd(coinId, coin);
      });

      // Listen for coins being removed (collected by any player)
      $(this.room.state).coins.onRemove((_coin: any, coinId: string) => {
        this.handleCoinRemove(coinId);
      });

      console.log("✅ Multiplayer connected!");
    } catch (error) {
      console.warn("⚠️ Connection failed");
      console.error(error);
      modalManager.updateLoadingMessage("Connection failed. Please retry.");
    }
  }

  private handleLocalPlayerAdd(playerState: Player, sessionId: string) {
    if (
      typeof playerState.x === "number" &&
      typeof playerState.y === "number"
    ) {
      this.player.setPosition(playerState.x, playerState.y);
    }

    if (typeof playerState.flipX === "boolean") {
      this.player.setFlipX(playerState.flipX);
    }

    this.playerTint =
      typeof playerState.tint === "number" ? playerState.tint : 0xffffff;
    this.player.setTint(this.playerTint);

    const labelText = this.formatSessionId(sessionId);
    if (!this.playerLabel) {
      this.playerLabel = new NameLabel(
        this,
        this.player.x,
        this.player.y + this.player.displayHeight / 2 + 6,
        labelText,
        this.playerTint
      );
    } else {
      this.playerLabel.setText(labelText);
      this.playerLabel.setTint(this.playerTint);
    }

    this.playerLabel.setDepth(this.player.depth + 1);
    this.healthController.attachLabel(this.playerLabel, labelText);
    this.healthController.initializeFromState(playerState);

    const animation = playerState.animation || "idle";
    if (this.player.anims.currentAnim?.key !== animation) {
      this.player.play(animation, true);
    }

    // Ensure admin flag reflects latest server state once local player exists.
    if (this.room) {
      this.isAdmin = this.room.state.adminId === sessionId;
    }

    this.finishReported = !!playerState.finished;
    this.updateCountdownDisplay();
    this.updateLobbyOverlay();

    modalManager.hideLoading();
  }

  private updatePlayerCount() {
    if (this.room) {
      const count = this.room.state.players.size;
      this.playerCountText.setText(`Players joined: ${count}`);

      // Update lobby overlay when player count changes
      if (this.gameState === "lobby") {
        this.updateLobbyOverlay(true);
      }
    }
  }

  private updateLocalPlayerLabel() {
    if (!this.playerLabel) {
      return;
    }

    const offsetY = this.player.displayHeight / 2 + 6;
    this.playerLabel.setPosition(this.player.x, this.player.y + offsetY);
    this.playerLabel.setDepth(this.player.depth + 1);
    this.playerLabel.setTint(this.playerTint);
  }

  private updateScoreDisplay() {
    if (!this.room || !this.playerScoreText) {
      return;
    }

    const mySessionId = this.room.sessionId;
    const playerState = this.room.state.players.get(mySessionId);

    if (playerState && typeof playerState.score === "number") {
      this.playerScoreText.setText(`Score: ${playerState.score}`);
    }
  }

  private formatSessionId(sessionId: string): string {
    return sessionId;
  }

  private createCountdownDisplay() {
    if (this.countdownText) {
      return;
    }

    this.countdownText = this.add.text(this.cameras.main.width / 2, 16, "", {
      fontSize: "22px",
      color: "#ffe066",
      backgroundColor: "#000000",
      padding: { x: 12, y: 6 },
      fontStyle: "bold",
    });
    this.countdownText.setOrigin(0.5, 0);
    this.countdownText.setScrollFactor(0);
    this.countdownText.setDepth(1000);
    this.countdownText.setVisible(false);
  }

  private updateCountdown(value: number) {
    this.countdownSeconds = Math.max(0, Math.floor(value));
    this.updateCountdownDisplay();
  }

  private updateCountdownDisplay() {
    if (!this.countdownText) {
      return;
    }

    this.countdownText.setPosition(this.cameras.main.width / 2, 16);

    if (this.gameStarted && !this.gameEnded) {
      this.countdownText.setText(`Time Left: ${this.countdownSeconds}s`);
      this.countdownText.setVisible(true);
    } else if (this.gameEnded) {
      this.countdownText.setText("Time Left: 0s");
      this.countdownText.setVisible(true);
    } else {
      this.countdownText.setVisible(false);
    }
  }

  private updateLobbyOverlay(force = false) {
    if (!this.playerLabel) {
      return;
    }

    // Throttle updates unless forced
    const now = Date.now();
    if (!force && now - this.lastLobbyUpdateTime < this.LOBBY_UPDATE_INTERVAL) {
      return;
    }
    this.lastLobbyUpdateTime = now;

    const state = this.gameState;

    if (state !== "lobby") {
      modalManager.hideLobby();
      return;
    }

    // In lobby state
    const playerCount = this.room?.state.players.size || 0;
    const message = this.isAdmin
      ? `You are the admin. Start the run when everyone is ready.`
      : `Waiting for the admin to start the run…`;

    modalManager.showLobby({
      title: "Waiting Lobby",
      message,
      playerCount,
      isAdmin: this.isAdmin,
      countdown: this.gameDurationSeconds,
    });
  }

  private hideLobbyOverlay() {
    modalManager.hideLobby();
  }

  private requestStartGame() {
    if (!this.room) {
      return;
    }

    this.room.send(MSG_START_GAME);
    modalManager.updateLobby({
      title: "Waiting Lobby",
      message: "Starting game…",
    });
  }

  private handleAdminChange(adminId: string, mySessionId: string) {
    const wasAdmin = this.isAdmin;
    this.isAdmin = adminId === mySessionId;

    // Only update if admin status changed
    if (wasAdmin !== this.isAdmin) {
      this.updateLobbyOverlay(true);
    }
  }

  private handleGameStartedChange(started: boolean) {
    const wasStarted = this.gameStarted;
    this.gameStarted = started;

    if (started && !wasStarted) {
      // Game just started
      this.gameEnded = false;
      this.finishReported = false;
      this.hideLobbyOverlay();
      modalManager.hideResults();
      console.log("🎮 Game started!");
    } else if (!started && wasStarted) {
      // Game was stopped
      console.log("⏸️ Game stopped");
    }

    if (!started && !this.gameEnded) {
      this.updateLobbyOverlay(true);
    }

    this.updateCountdownDisplay();
    this.updateQuizAvailability(this.gameStarted && !this.gameEnded);
  }

  private handleGameEndedChange(ended: boolean) {
    const wasEnded = this.gameEnded;
    this.gameEnded = ended;

    if (ended && !wasEnded) {
      // Game just ended
      this.finishReported = true;
      this.updateCountdown(0);
      this.hideLobbyOverlay();
      console.log("🏁 Game ended");
    }

    if (!ended && !this.gameStarted) {
      this.updateLobbyOverlay(true);
    }

    this.updateQuizAvailability(this.gameStarted && !this.gameEnded);
  }

  private handleGameStartMessage(payload: { countdown?: number }) {
    console.log("📨 Received game start message");

    this.gameStarted = true;
    this.gameEnded = false;
    this.finishReported = false;

    if (typeof payload?.countdown === "number") {
      this.countdownSeconds = payload.countdown;
    } else {
      this.countdownSeconds = this.gameDurationSeconds;
    }

    modalManager.hideResults();
    this.hideLobbyOverlay();
    this.updateCountdownDisplay();
    this.updateQuizAvailability(true);

    // Reset player position if needed
    if (this.player && this.room) {
      const myPlayer = this.room.state.players.get(this.localSessionId);
      if (myPlayer) {
        this.player.setPosition(myPlayer.x, myPlayer.y);
      }
    }
  }

  private handleGameResults(payload: GameResultsPayload) {
    this.gameEnded = true;
    this.gameStarted = false;
    this.finishReported = true;
    this.hideLobbyOverlay();
    this.updateCountdown(0);

    const mySessionId = this.room?.sessionId || "";

    // Get player scores from room state
    const results = payload.rankings.map((entry) => {
      const playerState = this.room?.state.players.get(entry.sessionId);
      return {
        sessionId: entry.sessionId,
        name: this.formatSessionId(entry.sessionId),
        rank: entry.rank,
        result: entry.result,
        score: playerState?.score || 0,
      };
    });

    modalManager.showResults({
      title: payload.timeExpired ? "Time's Up!" : "Game Over!",
      winnerId: payload.winnerId,
      results,
      mySessionId,
    });
    this.updateQuizAvailability(false);
  }

  private updateQuizAvailability(available: boolean) {
    if (this.quizAvailable === available) {
      return;
    }

    this.quizAvailable = available;

    window.dispatchEvent(
      new CustomEvent(QUIZ_AVAILABILITY_CHANGED, {
        detail: { available },
      })
    );
  }

  private handleCoinAdd(coinId: string, coinState: any) {
    if (!this.coins || !this.groundLayer) return;

    const variant = coinState.variant === "red" ? "coin-red" : "coin-gold";
    const animKey =
      coinState.variant === "red" ? "coin-red-spin" : "coin-gold-spin";

    // Use server's X position but find proper Y position on ground
    const serverX = coinState.x;
    const tileWidth = this.map.tileWidth || 32;
    const tileHeight = this.map.tileHeight || 32;
    const column = Math.floor(serverX / tileWidth);

    // Find ground tile at this column
    const groundTile = this.findGroundTileAtColumn(column);
    let finalY = coinState.y; // Fallback to server Y

    if (groundTile) {
      const tileTop = this.groundLayer.tileToWorldY(groundTile.y);
      // Position coin above the ground tile
      finalY = tileTop - tileHeight * 0.5;
    }

    const coin = this.coins.create(
      serverX,
      finalY,
      variant
    ) as Phaser.Physics.Arcade.Sprite;

    coin.setDepth(8);
    coin.setScale(2);
    coin.setData("coinId", coinId);
    coin.setData("healPercent", coinState.healPercent);

    coin.play(animKey, true);
    if (coin.anims.currentAnim) {
      coin.anims.setProgress(Math.random());
    }

    const body = coin.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.moves = false;

    const radius = coin.displayWidth * 0.32;
    body.setCircle(
      radius,
      coin.displayWidth / 2 - radius,
      coin.displayHeight / 2 - radius
    );

    console.log(
      `Coin ${coinId} added at (${serverX}, ${finalY}) - Ground tile: ${
        groundTile ? "found" : "fallback"
      }`
    );
  }

  private findGroundTileAtColumn(column: number): Phaser.Tilemaps.Tile | null {
    if (!this.groundLayer) return null;

    const layerHeight = this.groundLayer.layer.height;

    // Search from bottom to top for first solid tile with air above
    for (let row = layerHeight - 1; row >= 0; row--) {
      const tile = this.groundLayer.getTileAt(column, row);
      if (tile && tile.collides) {
        // Check if there's air above (no collision)
        if (row > 0) {
          const above = this.groundLayer.getTileAt(column, row - 1);
          if (above && above.collides) {
            continue; // This tile has solid tile above, keep searching
          }
        }
        return tile;
      }
    }

    return null;
  }

  private handleCoinRemove(coinId: string) {
    if (!this.coins) return;

    // Find and remove the coin from the group
    const children = this.coins.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const coin = children.find((c) => c.getData("coinId") === coinId);

    if (coin) {
      // Completely remove the coin
      this.coins.remove(coin, true, true);
      console.log(`Coin ${coinId} removed (collected)`);
    }
  }

  update(time: number, delta: number) {
    this.starfield?.update(delta);
    this.cloudManager?.update(delta);

    // Skip if not connected yet
    if (!this.room) {
      return;
    }

    if (!this.player || !this.player.body) return;

    // Update lobby overlay periodically when in lobby state
    if (this.gameState === "lobby") {
      this.updateLobbyOverlay(false);
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.touching.down || body.blocked.down;

    // Update shadow
    const shadowOffsetX = this.player.flipX ? 10 : -10;
    const shadowOffsetY = 32;

    if (onGround) {
      this.shadow.setVisible(true);
      this.shadow.x = this.player.x + shadowOffsetX;
      this.shadow.y = this.player.y + shadowOffsetY;
      this.shadow.setAlpha(0.4);
    } else {
      this.shadow.setVisible(false);
    }

    // Reset jump count on ground
    if (onGround) {
      this.jumpCount = 0;
    }

    if (!this.gameStarted || this.gameEnded) {
      this.player.setVelocityX(0);
      if (onGround && this.player.anims.currentAnim?.key !== "idle") {
        this.player.play("idle", true);
      }
      if (
        time - this.lastSnapshotSentAt >= this.snapshotInterval &&
        this.room
      ) {
        this.room.send(0, {
          x: this.player.x,
          y: this.player.y,
        });
        this.lastSnapshotSentAt = time;
      }
      this.updateLocalPlayerLabel();
      this.healthController.update();
      this.remotePlayers.update(delta);
      return;
    }

    // Send authoritative player state to the server at a fixed interval
    if (
      this.gameStarted &&
      !this.gameEnded &&
      time - this.lastSnapshotSentAt >= this.snapshotInterval
    ) {
      const currentAnimation = this.player.anims.currentAnim?.key ?? "idle";

      this.room.send(0, {
        x: this.player.x,
        y: this.player.y,
        flipX: this.player.flipX,
        animation: currentAnimation,
      });

      this.lastSnapshotSentAt = time;
    }

    if (this.quizActive) {
      this.player.setVelocityX(0);
      if (onGround && this.player.anims.currentAnim?.key !== "idle") {
        this.player.play("idle", true);
      }
      this.updateLocalPlayerLabel();
      this.healthController.update();
      this.remotePlayers.update(delta);
      return;
    }

    if (!this.healthController.canMove()) {
      this.player.setVelocityX(0);
      if (onGround && this.player.anims.currentAnim?.key !== "idle") {
        this.player.play("idle", true);
      }
      this.updateLocalPlayerLabel();
      this.healthController.update();
      this.remotePlayers.update(delta);
      return;
    }

    const horizontalPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.left) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.right);
    const horizontalHeld =
      this.cursors.left.isDown || this.cursors.right.isDown;

    const horizontalResult = this.healthController.handleHorizontalInput(
      time,
      horizontalPressed,
      horizontalHeld
    );

    let movementBlocked = horizontalResult.blocked;
    let costSpentThisFrame = horizontalResult.consumed;

    if (movementBlocked) {
      this.player.setVelocityX(0);
      if (onGround && this.player.anims.currentAnim?.key !== "idle") {
        this.player.play("idle", true);
      }
    } else if (this.cursors.left.isDown) {
      this.player.setVelocityX(-250);
      this.player.setFlipX(true);
      if (onGround && this.player.anims.currentAnim?.key !== "walk") {
        this.player.play("walk", true);
      }
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(250);
      this.player.setFlipX(false);
      if (onGround && this.player.anims.currentAnim?.key !== "walk") {
        this.player.play("walk", true);
      }
    } else {
      this.player.setVelocityX(0);
      if (onGround && this.player.anims.currentAnim?.key !== "idle") {
        this.player.play("idle", true);
      }
    }

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.spaceKey);

    if (jumpPressed && this.jumpCount < this.maxJumps) {
      const jumpResult = this.healthController.handleJumpRequest(
        time,
        costSpentThisFrame
      );

      if (!jumpResult.blocked) {
        this.player.setVelocityY(-450);
        if (this.player.anims.currentAnim?.key !== "jump") {
          this.player.play("jump", true);
        }
        this.jumpCount++;
        costSpentThisFrame = costSpentThisFrame || jumpResult.consumed;
      } else {
        movementBlocked = true;
      }
    }

    if (movementBlocked) {
      this.player.setVelocityX(0);
      if (onGround && this.player.anims.currentAnim?.key !== "idle") {
        this.player.play("idle", true);
      }
    }

    if (!onGround && this.player.anims.currentAnim?.key !== "jump") {
      this.player.play("jump", true);
    }

    this.updateLocalPlayerLabel();
    this.healthController.update();
    this.updateScoreDisplay();

    this.remotePlayers.update(delta);

    if (
      this.gameStarted &&
      !this.gameEnded &&
      !this.finishReported &&
      this.player.x >= this.finishLineX
    ) {
      this.finishReported = true;
      this.room.send(MSG_PLAYER_FINISHED);
    }
  }

  shutdown() {
    if (this.quizEventHandlers) {
      unregisterQuizEventListeners(this.quizEventHandlers);
      this.quizEventHandlers = undefined;
    }
    this.quizActive = false;
    this.coinOverlap?.destroy();
    this.coinOverlap = undefined;
    if (this.coins) {
      this.coins.clear(true, true);
    }
    this.healthController?.clearLabel();
    this.playerLabel?.destroy();
    this.remotePlayers?.clear();
    this.bgMusic?.stop();
    this.bgMusic?.destroy();
    modalManager.hideAll();
    if (this.server) {
      this.server.leave();
    }
    this.cloudManager?.destroy();
    this.starfield?.destroy();
    this.updateQuizAvailability(false);
  }
}
