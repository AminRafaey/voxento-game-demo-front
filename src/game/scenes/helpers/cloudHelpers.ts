import Phaser from "phaser";

interface CloudLayerConfig {
  textureKey: string;
  count: number;
  minSpeed: number;
  maxSpeed: number;
  minScale: number;
  maxScale: number;
  minAlpha?: number;
  maxAlpha?: number;
  yRange?: [number, number];
  scrollFactor?: number;
  depth?: number;
}

interface CloudInstance {
  sprite: Phaser.GameObjects.Image;
  speed: number;
  width: number;
  config: CloudLayerConfig;
}

export class CloudManager {
  private readonly clouds: CloudInstance[] = [];
  private readonly margin = 160;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {}

  createLayer(config: CloudLayerConfig) {
    const {
      textureKey,
      count,
      minSpeed,
      maxSpeed,
      minScale,
      maxScale,
      minAlpha = 0.45,
      maxAlpha = 0.85,
      yRange,
      scrollFactor = 0.3,
      depth = 2,
    } = config;

    const clampedCount = Math.max(1, Math.floor(count));

    for (let index = 0; index < clampedCount; index++) {
      const startX = Phaser.Math.Between(
        -this.margin,
        Math.ceil(this.worldWidth + this.margin)
      );
      const [minY, maxY] = yRange ?? [
        this.worldHeight * 0.05,
        this.worldHeight * 0.35,
      ];
      const startY = Phaser.Math.Between(Math.floor(minY), Math.floor(maxY));

      const sprite = this.scene.add.image(startX, startY, textureKey);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScrollFactor(scrollFactor, scrollFactor);
      sprite.setDepth(depth);

      const scale = Phaser.Math.FloatBetween(minScale, maxScale);
      sprite.setScale(scale);

      const alpha = Phaser.Math.FloatBetween(minAlpha, maxAlpha);
      sprite.setAlpha(alpha);

      const speed = Phaser.Math.FloatBetween(minSpeed, maxSpeed);

      this.clouds.push({
        sprite,
        speed,
        width: sprite.displayWidth,
        config,
      });
    }
  }

  update(delta: number) {
    if (this.clouds.length === 0) {
      return;
    }

    const deltaSeconds = delta / 1000;

    this.clouds.forEach((cloud) => {
      const { sprite, speed, config } = cloud;
      sprite.x -= speed * deltaSeconds;

      if (sprite.x + sprite.displayWidth / 2 < -this.margin) {
        this.repositionSprite(sprite, config);
      }
    });
  }

  destroy() {
    this.clouds.forEach((cloud) => cloud.sprite.destroy());
    this.clouds.length = 0;
  }

  private repositionSprite(
    sprite: Phaser.GameObjects.Image,
    config: CloudLayerConfig
  ) {
    const [minY, maxY] = config.yRange ?? [
      this.worldHeight * 0.05,
      this.worldHeight * 0.35,
    ];
    sprite.x = -this.margin - sprite.displayWidth * 0.5;
    sprite.y = Phaser.Math.Between(Math.floor(minY), Math.floor(maxY));

    const scale = Phaser.Math.FloatBetween(config.minScale, config.maxScale);
    sprite.setScale(scale);

    const alpha = Phaser.Math.FloatBetween(
      config.minAlpha ?? 0.45,
      config.maxAlpha ?? 0.85
    );
    sprite.setAlpha(alpha);

    const speed = Phaser.Math.FloatBetween(config.minSpeed, config.maxSpeed);
    const cloud = this.clouds.find((entry) => entry.sprite === sprite);
    if (cloud) {
      cloud.speed = speed;
      cloud.width = sprite.displayWidth;
    }
  }
}
