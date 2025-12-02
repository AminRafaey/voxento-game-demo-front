import { Scene } from "phaser";
import Server from "../../services/Server";
import { Room, getStateCallbacks } from "colyseus.js";
import { MyRoomState, Player } from "../../types/state.types";
import LoadingOverlay from "../components/LoadingOverlay";
import RemotePlayerManager from "../components/RemotePlayerManager";
import NameLabel from "../components/NameLabel";
import LocalHealthController from "../components/LocalHealthController";
import {
  createCoinPickupHandler,
  populateCoins,
  registerCoinAnimations,
} from "./helpers/coinHelpers";
import {
  registerQuizEventListeners,
  unregisterQuizEventListeners,
  type QuizEventBindings,
} from "./helpers/quizEventHelpers";

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
  private loadingOverlay!: LoadingOverlay;
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

  constructor() {
    super("MainMenu");
  }

  init(data: { server: Server }) {
    this.server = data.server;
  }

  async create() {
    // Create tilemap
    this.map = this.make.tilemap({ key: "tilemap" });
    const tileset = this.map.addTilesetImage("tilesheet", "tiles");

    const mapWidth = this.map.widthInPixels;
    const mapHeight = this.map.heightInPixels;

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

    // Add background
    const bg = this.add.image(mapWidth / 2, mapHeight / 2, "background");
    bg.setDisplaySize(mapWidth, mapHeight);
    bg.setScrollFactor(1);

    // Create ground layer
    if (tileset) {
      this.groundLayer = this.map.createLayer("long_map", tileset, 0, 0)!;
      this.groundLayer.setCollisionByProperty({ collides: true });
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

    if (this.groundLayer) {
      populateCoins({
        map: this.map,
        groundLayer: this.groundLayer,
        coins: this.coins,
        player: this.player,
      });
    }

    this.handleCoinPickup = createCoinPickupHandler(
      this,
      this.healthController
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

    this.loadingOverlay = new LoadingOverlay(this);
    this.loadingOverlay.show("Connecting to server...");

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

      this.loadingOverlay.setMessage("Joined room. Waiting for spawn...");

      console.log("🎮 Connected - Session:", mySessionId);

      // Use getStateCallbacks for proper state synchronization
      const $ = getStateCallbacks(this.room);

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

        this.remotePlayers.applyState(sessionId, player as Player, true);
      });

      // Remove local reference when entity is removed from the server
      $(this.room.state).players.onRemove((_player: any, sessionId: string) => {
        this.remotePlayers.remove(sessionId);
        console.log("👋 Player left:", sessionId);
        this.updatePlayerCount();
      });

      console.log("✅ Multiplayer connected!");
    } catch (error) {
      console.warn("⚠️ Connection failed");
      console.error(error);
      this.loadingOverlay.setMessage("Connection failed. Please retry.");
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

    this.loadingOverlay.hide();
  }

  private updatePlayerCount() {
    if (this.room) {
      const count = this.room.state.players.size;
      this.playerCountText.setText(`Players joined: ${count}`);
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

  private formatSessionId(sessionId: string): string {
    return sessionId;
  }

  update(time: number, delta: number) {
    // Skip if not connected yet
    if (!this.room) {
      return;
    }

    if (!this.player || !this.player.body) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.touching.down || body.blocked.down;

    // Send authoritative player state to the server at a fixed interval
    if (time - this.lastSnapshotSentAt >= this.snapshotInterval) {
      const currentAnimation = this.player.anims.currentAnim?.key ?? "idle";

      this.room.send(0, {
        x: this.player.x,
        y: this.player.y,
        flipX: this.player.flipX,
        animation: currentAnimation,
      });

      this.lastSnapshotSentAt = time;
    }

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

    this.remotePlayers.update(delta);
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
    this.loadingOverlay?.destroy();
    if (this.server) {
      this.server.leave();
    }
  }
}
