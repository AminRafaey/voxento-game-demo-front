import Phaser from "phaser";

interface StarfieldConfig {
  textureKey: string;
  count: number;
  minSpeed: number;
  maxSpeed: number;
  minScale: number;
  maxScale: number;
  minAlpha?: number;
  maxAlpha?: number;
  depth?: number;
  scrollFactor?: number;
  yRange?: [number, number];
}

interface StarInstance {
  sprite: Phaser.GameObjects.Image;
  speed: number;
  baseAlpha: number;
  flickerAmplitude: number;
  flickerSpeed: number;
  elapsed: number;
  config: StarfieldConfig;
}

export class StarfieldManager {
  private readonly stars: StarInstance[] = [];
  private readonly margin = 200;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {}

  create(config: StarfieldConfig) {
    const {
      textureKey,
      count,
      minSpeed,
      maxSpeed,
      minScale,
      maxScale,
      minAlpha = 0.35,
      maxAlpha = 0.75,
      depth = 0.5,
      scrollFactor = 0.15,
      yRange,
    } = config;

    const clampedCount = Math.max(1, Math.floor(count));

    for (let index = 0; index < clampedCount; index++) {
      const startX = Phaser.Math.Between(
        -this.margin,
        Math.ceil(this.worldWidth + this.margin)
      );
      const [minY, maxY] = yRange ?? [
        this.worldHeight * 0.04,
        this.worldHeight * 0.4,
      ];
      const startY = Phaser.Math.Between(Math.floor(minY), Math.floor(maxY));

      const sprite = this.scene.add.image(startX, startY, textureKey);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(depth);
      sprite.setScrollFactor(scrollFactor, scrollFactor);

      const scale = Phaser.Math.FloatBetween(minScale, maxScale);
      sprite.setScale(scale);

      const baseAlpha = Phaser.Math.FloatBetween(minAlpha, maxAlpha);
      sprite.setAlpha(baseAlpha);

      const flickerAmplitude = Phaser.Math.FloatBetween(0.08, 0.22);
      const flickerSpeed = Phaser.Math.FloatBetween(1.2, 2.4);

      const speed = Phaser.Math.FloatBetween(minSpeed, maxSpeed);

      this.stars.push({
        sprite,
        speed,
        baseAlpha,
        flickerAmplitude,
        flickerSpeed,
        elapsed: Phaser.Math.FloatBetween(0, Math.PI * 2),
        config,
      });
    }
  }

  update(delta: number) {
    if (this.stars.length === 0) {
      return;
    }

    const deltaSeconds = delta / 1000;

    this.stars.forEach((star) => {
      const { sprite, speed, config } = star;

      sprite.x += speed * deltaSeconds;
      star.elapsed += deltaSeconds * star.flickerSpeed;

      const flicker = Math.sin(star.elapsed) * star.flickerAmplitude;
      sprite.setAlpha(Phaser.Math.Clamp(star.baseAlpha + flicker, 0.1, 1));

      if (sprite.x - sprite.displayWidth / 2 > this.worldWidth + this.margin) {
        this.reposition(sprite, star, config);
      }
    });
  }

  destroy() {
    this.stars.forEach((star) => star.sprite.destroy());
    this.stars.length = 0;
  }

  private reposition(
    sprite: Phaser.GameObjects.Image,
    star: StarInstance,
    config: StarfieldConfig
  ) {
    const [minY, maxY] = config.yRange ?? [
      this.worldHeight * 0.04,
      this.worldHeight * 0.4,
    ];

    sprite.x = -this.margin - sprite.displayWidth * 0.5;
    sprite.y = Phaser.Math.Between(Math.floor(minY), Math.floor(maxY));

    const scale = Phaser.Math.FloatBetween(config.minScale, config.maxScale);
    sprite.setScale(scale);

    star.baseAlpha = Phaser.Math.FloatBetween(
      config.minAlpha ?? 0.35,
      config.maxAlpha ?? 0.75
    );
    sprite.setAlpha(star.baseAlpha);

    star.flickerAmplitude = Phaser.Math.FloatBetween(0.08, 0.22);
    star.flickerSpeed = Phaser.Math.FloatBetween(1.2, 2.4);
    star.elapsed = Phaser.Math.FloatBetween(0, Math.PI * 2);

    star.speed = Phaser.Math.FloatBetween(config.minSpeed, config.maxSpeed);
  }
}
