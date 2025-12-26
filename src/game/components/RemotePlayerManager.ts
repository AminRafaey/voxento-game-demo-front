import Phaser from "phaser";
import { Player } from "../../types/state.types";
import NameLabel from "./NameLabel";

interface RemotePlayerEntity {
  sessionId: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: NameLabel;
  labelBase: string;
  targetX: number;
  targetY: number;
  targetFlipX: boolean;
  targetAnimation: string;
  previousX: number;
  previousY: number;
  lerpElapsed: number;
  lerpDuration: number;
  tint: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  lastUpdateTime: number;
}

interface RemotePlayerManagerOptions {
  interpolationDuration: number;
  formatSessionId?: (sessionId: string) => string;
}

export default class RemotePlayerManager {
  private readonly entities = new Map<string, RemotePlayerEntity>();
  private readonly formatSessionId: (sessionId: string) => string;
  private readonly DISTANCE_SNAP_THRESHOLD = 200; // Snap if too far away
  private readonly ANIMATION_PRIORITY: Record<string, number> = {
    jump: 3,
    walk: 2,
    idle: 1,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: RemotePlayerManagerOptions
  ) {
    this.formatSessionId =
      options.formatSessionId || ((sessionId) => sessionId);
  }

  add(sessionId: string, state: Player): RemotePlayerEntity | null {
    // Check if entity already exists
    if (this.entities.has(sessionId)) {
      console.warn(`Remote player ${sessionId} already exists`);
      return this.entities.get(sessionId) || null;
    }

    // Use actual state position (from server) - this ensures proper spawn location
    // Default to a safe spawn position if coordinates are invalid
    const spawnX =
      typeof state.x === "number" && Number.isFinite(state.x) && state.x !== 0
        ? state.x
        : 120; // Default spawn X
    const spawnY =
      typeof state.y === "number" && Number.isFinite(state.y) && state.y !== 0
        ? state.y
        : 300; // Default spawn Y
    const tint = typeof state.tint === "number" ? state.tint : 0xaaaaff;
    const animation = state.animation || "idle";

    try {
      console.log(
        `Spawning remote player ${sessionId} at (${spawnX}, ${spawnY}) - state: (${state.x}, ${state.y})`
      );

      const sprite = this.scene.add.sprite(
        spawnX,
        spawnY,
        "sprite",
        "sprite_idle"
      );
      sprite.setScale(0.6);
      sprite.setDepth(10);
      sprite.setTint(tint);
      sprite.setFlipX(!!state.flipX);

      const shadow = this.scene.add.ellipse(
        spawnX,
        spawnY + 32,
        40,
        12,
        0x000000,
        0.4
      );
      shadow.setDepth(9);

      const labelBase = this.formatSessionId(sessionId);
      const label = new NameLabel(
        this.scene,
        spawnX,
        spawnY + sprite.displayHeight / 2 + 6,
        labelBase,
        tint
      );
      label.setDepth(11);

      const health = typeof state.health === "number" ? state.health : 1000;
      const maxHealth =
        typeof state.maxHealth === "number" ? state.maxHealth : 1000;
      label.setText(this.composeLabel(labelBase, health, maxHealth));

      if (sprite.anims.exists(animation)) {
        sprite.play(animation, true);
      } else {
        console.warn(`Animation ${animation} does not exist, using idle`);
        sprite.play("idle", true);
      }

      const entity: RemotePlayerEntity = {
        sessionId,
        sprite,
        shadow,
        label,
        labelBase,
        targetX: spawnX,
        targetY: spawnY,
        targetFlipX: !!state.flipX,
        targetAnimation: animation,
        previousX: spawnX,
        previousY: spawnY,
        lerpElapsed: this.options.interpolationDuration,
        lerpDuration: this.options.interpolationDuration,
        tint,
        health,
        maxHealth,
        isDestroyed: false,
        lastUpdateTime: Date.now(),
      };

      this.entities.set(sessionId, entity);
      this.refreshLabel(entity);
      return entity;
    } catch (error) {
      console.error(`Failed to create remote player ${sessionId}:`, error);
      return null;
    }
  }

  applyState(sessionId: string, state: Player, immediate = false) {
    const entity = this.entities.get(sessionId);
    if (!entity || entity.isDestroyed) return;

    const nextX = typeof state.x === "number" ? state.x : entity.targetX;
    const nextY = typeof state.y === "number" ? state.y : entity.targetY;
    const nextFlipX =
      typeof state.flipX === "boolean" ? state.flipX : entity.targetFlipX;
    const nextAnimation = state.animation || entity.targetAnimation || "idle";
    const nextTint = typeof state.tint === "number" ? state.tint : entity.tint;
    const nextHealth =
      typeof state.health === "number" ? state.health : entity.health;
    const nextMaxHealth =
      typeof state.maxHealth === "number" ? state.maxHealth : entity.maxHealth;

    entity.lastUpdateTime = Date.now();

    // Calculate distance to determine if we should snap
    const distanceToTarget = Phaser.Math.Distance.Between(
      entity.sprite.x,
      entity.sprite.y,
      nextX,
      nextY
    );
    const shouldSnap =
      immediate || distanceToTarget > this.DISTANCE_SNAP_THRESHOLD;

    entity.targetX = nextX;
    entity.targetY = nextY;
    entity.targetFlipX = nextFlipX;
    entity.targetAnimation = nextAnimation;
    entity.tint = nextTint;
    entity.health = nextHealth;
    entity.maxHealth = nextMaxHealth;

    if (shouldSnap) {
      // Immediate position update
      entity.previousX = nextX;
      entity.previousY = nextY;
      entity.lerpElapsed = entity.lerpDuration;

      entity.sprite.setPosition(nextX, nextY);
      entity.sprite.setFlipX(nextFlipX);
      entity.sprite.setTint(nextTint);

      entity.label.setPosition(
        nextX,
        nextY + entity.sprite.displayHeight / 2 + 6
      );
      entity.label.setTint(nextTint);
      entity.label.setDepth(entity.sprite.depth + 1);
      this.refreshLabel(entity);

      this.playAnimation(entity, nextAnimation);
      this.updateShadow(entity, nextAnimation);
      return;
    }

    // Smooth interpolation
    entity.previousX = entity.sprite.x;
    entity.previousY = entity.sprite.y;
    entity.lerpElapsed = 0;
    entity.lerpDuration = this.options.interpolationDuration;
    entity.sprite.setTint(nextTint);
    entity.label.setTint(nextTint);
    this.refreshLabel(entity);
  }

  remove(sessionId: string) {
    const entity = this.entities.get(sessionId);
    if (!entity) return;

    // Mark as destroyed to prevent race conditions
    entity.isDestroyed = true;

    try {
      if (entity.sprite && !entity.sprite.scene) {
        // Already destroyed
        this.entities.delete(sessionId);
        return;
      }

      entity.sprite?.destroy();
      entity.shadow?.destroy();
      entity.label?.destroy();
    } catch (error) {
      console.error(`Error destroying remote player ${sessionId}:`, error);
    } finally {
      this.entities.delete(sessionId);
    }
  }

  clear() {
    const sessionIds = Array.from(this.entities.keys());
    sessionIds.forEach((sessionId) => this.remove(sessionId));
  }

  has(sessionId: string): boolean {
    return (
      this.entities.has(sessionId) && !this.entities.get(sessionId)?.isDestroyed
    );
  }

  getCount(): number {
    return Array.from(this.entities.values()).filter((e) => !e.isDestroyed)
      .length;
  }

  update(delta: number) {
    this.entities.forEach((entity) => {
      if (entity.isDestroyed) return;

      try {
        // Update interpolation
        entity.lerpElapsed = Math.min(
          entity.lerpElapsed + delta,
          entity.lerpDuration
        );
        const duration =
          entity.lerpDuration || this.options.interpolationDuration;
        const t = duration > 0 ? entity.lerpElapsed / duration : 1;

        // Smooth easing function for more natural movement
        const easedT = this.easeOutCubic(t);

        const x = Phaser.Math.Linear(entity.previousX, entity.targetX, easedT);
        const y = Phaser.Math.Linear(entity.previousY, entity.targetY, easedT);

        entity.sprite.setPosition(x, y);
        entity.sprite.setFlipX(entity.targetFlipX);

        // Play animation if needed
        this.playAnimation(entity, entity.targetAnimation);

        const labelOffsetY = entity.sprite.displayHeight / 2 + 6;
        entity.label.setPosition(x, y + labelOffsetY);
        entity.label.setDepth(entity.sprite.depth + 1);
        entity.label.setTint(entity.tint);

        this.updateShadow(entity, entity.targetAnimation);
      } catch (error) {
        console.error(
          `Error updating remote player ${entity.sessionId}:`,
          error
        );
        entity.isDestroyed = true;
      }
    });
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private playAnimation(entity: RemotePlayerEntity, animation: string) {
    if (!entity.sprite.anims || entity.isDestroyed) return;

    const currentAnim = entity.sprite.anims.currentAnim?.key;

    // Don't interrupt higher priority animations
    if (
      currentAnim &&
      this.ANIMATION_PRIORITY[currentAnim] > this.ANIMATION_PRIORITY[animation]
    ) {
      return;
    }

    if (currentAnim !== animation) {
      if (this.scene.anims.exists(animation)) {
        entity.sprite.play(animation, true);
      }
    }
  }

  private updateShadow(entity: RemotePlayerEntity, animation: string) {
    const shadowOffsetX = entity.targetFlipX ? 10 : -10;
    const shadowOffsetY = 32;

    if (animation === "jump") {
      entity.shadow.setVisible(false);
      return;
    }

    entity.shadow.setVisible(true);
    entity.shadow.x = entity.sprite.x + shadowOffsetX;
    entity.shadow.y = entity.sprite.y + shadowOffsetY;
  }

  private composeLabel(base: string, health: number, maxHealth: number) {
    const percent = maxHealth > 0 ? Math.round((health / maxHealth) * 1000) : 0;
    const clamped = Math.max(0, Math.min(1000, percent));
    return `${base} • ${clamped}%`;
  }

  private refreshLabel(entity: RemotePlayerEntity) {
    entity.label.setText(
      this.composeLabel(entity.labelBase, entity.health, entity.maxHealth)
    );
  }
}
