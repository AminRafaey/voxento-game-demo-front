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
}

interface RemotePlayerManagerOptions {
  interpolationDuration: number;
  formatSessionId?: (sessionId: string) => string;
}

export default class RemotePlayerManager {
  private readonly entities = new Map<string, RemotePlayerEntity>();
  private readonly formatSessionId: (sessionId: string) => string;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: RemotePlayerManagerOptions
  ) {
    this.formatSessionId =
      options.formatSessionId || ((sessionId) => sessionId);
  }

  add(sessionId: string, state: Player): RemotePlayerEntity {
    const spawnX = typeof state.x === "number" ? state.x : 0;
    const spawnY = typeof state.y === "number" ? state.y : 0;
    const tint = typeof state.tint === "number" ? state.tint : 0xaaaaff;
    const animation = state.animation || "idle";

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

    if (sprite.anims.currentAnim?.key !== animation) {
      sprite.play(animation, true);
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
    };

    this.entities.set(sessionId, entity);
    this.refreshLabel(entity);
    return entity;
  }

  applyState(sessionId: string, state: Player, immediate = false) {
    const entity = this.entities.get(sessionId);
    if (!entity) return;

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

    entity.targetX = nextX;
    entity.targetY = nextY;
    entity.targetFlipX = nextFlipX;
    entity.targetAnimation = nextAnimation;
    entity.tint = nextTint;
    entity.health = nextHealth;
    entity.maxHealth = nextMaxHealth;

    if (immediate) {
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

      if (entity.sprite.anims.currentAnim?.key !== nextAnimation) {
        entity.sprite.play(nextAnimation, true);
      }

      this.updateShadow(entity, nextAnimation);
      return;
    }

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

    entity.sprite.destroy();
    entity.shadow.destroy();
    entity.label.destroy();
    this.entities.delete(sessionId);
  }

  clear() {
    this.entities.forEach((entity) => {
      entity.sprite.destroy();
      entity.shadow.destroy();
      entity.label.destroy();
    });
    this.entities.clear();
  }

  update(delta: number) {
    this.entities.forEach((entity) => {
      entity.lerpElapsed = Math.min(
        entity.lerpElapsed + delta,
        entity.lerpDuration
      );
      const duration =
        entity.lerpDuration || this.options.interpolationDuration;
      const t = duration > 0 ? entity.lerpElapsed / duration : 1;

      const x = Phaser.Math.Linear(entity.previousX, entity.targetX, t);
      const y = Phaser.Math.Linear(entity.previousY, entity.targetY, t);

      entity.sprite.setPosition(x, y);
      entity.sprite.setFlipX(entity.targetFlipX);
      if (entity.sprite.anims.currentAnim?.key !== entity.targetAnimation) {
        entity.sprite.play(entity.targetAnimation, true);
      }

      const labelOffsetY = entity.sprite.displayHeight / 2 + 6;
      entity.label.setPosition(x, y + labelOffsetY);
      entity.label.setDepth(entity.sprite.depth + 1);
      entity.label.setTint(entity.tint);

      this.updateShadow(entity, entity.targetAnimation);
    });
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
