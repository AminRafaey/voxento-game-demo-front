import Phaser from "phaser";
import LocalHealthController from "../../components/LocalHealthController";

export function registerCoinAnimations(scene: Phaser.Scene) {
  const goldKey = "coin-gold-spin";
  const redKey = "coin-red-spin";

  if (!scene.anims.exists(goldKey)) {
    scene.anims.create({
      key: goldKey,
      frames: scene.anims.generateFrameNumbers("coin-gold", {
        start: 0,
        end: 4,
      }),
      frameRate: 10,
      repeat: -1,
    });
  }

  if (!scene.anims.exists(redKey)) {
    scene.anims.create({
      key: redKey,
      frames: scene.anims.generateFrameNumbers("coin-red", {
        start: 0,
        end: 4,
      }),
      frameRate: 10,
      repeat: -1,
    });
  }
}

export interface PopulateCoinsParams {
  map: Phaser.Tilemaps.Tilemap;
  groundLayer: Phaser.Tilemaps.TilemapLayer;
  coins: Phaser.Physics.Arcade.Group;
  player: Phaser.Physics.Arcade.Sprite;
}

export function populateCoins({
  map,
  groundLayer,
  coins,
  player,
}: PopulateCoinsParams) {
  if (!map || !groundLayer || !coins) {
    return;
  }

  coins.clear(true, true);

  const variants: Array<{
    textureKey: "coin-gold" | "coin-red";
    animationKey: "coin-gold-spin" | "coin-red-spin";
    healPercent: number;
  }> = [
    {
      textureKey: "coin-gold",
      animationKey: "coin-gold-spin",
      healPercent: 0.1,
    },
    {
      textureKey: "coin-red",
      animationKey: "coin-red-spin",
      healPercent: 0.15,
    },
  ];

  const tileWidth = map.tileWidth || 32;
  const tileHeight = map.tileHeight || 32;
  const minHorizontalSpacing = tileWidth * 6;
  const maxCoins = 22;

  const spawnCandidates: Array<{
    x: number;
    tileTop: number;
    variantIndex: number;
  }> = [];

  for (let column = 1; column < map.width - 1; column++) {
    if (Phaser.Math.Between(0, 100) < 35) {
      continue;
    }

    const groundTile = findGroundTile(groundLayer, column);
    if (!groundTile) {
      continue;
    }

    const worldX = column * tileWidth + tileWidth / 2;
    if (
      spawnCandidates.some(
        (candidate) => Math.abs(candidate.x - worldX) < minHorizontalSpacing
      )
    ) {
      continue;
    }

    const tileTop = groundLayer.tileToWorldY(groundTile.y);
    if (tileTop <= 0) {
      continue;
    }
    spawnCandidates.push({
      x: worldX,
      tileTop,
      variantIndex: Phaser.Math.Between(0, variants.length - 1),
    });

    if (spawnCandidates.length >= maxCoins) {
      break;
    }
  }

  if (spawnCandidates.length === 0) {
    const fallbackColumn = Math.max(
      1,
      Math.min(map.width - 2, Math.floor(player.x / tileWidth))
    );
    const fallbackTile =
      findGroundTile(groundLayer, fallbackColumn) ||
      findGroundTile(groundLayer, fallbackColumn + 1) ||
      findGroundTile(groundLayer, fallbackColumn - 1);

    if (fallbackTile) {
      const tileTop = groundLayer.tileToWorldY(fallbackTile.y);
      if (tileTop > 0) {
        const worldX = fallbackTile.x * tileWidth + tileWidth / 2;
        spawnCandidates.push({
          x: worldX,
          tileTop,
          variantIndex: Phaser.Math.Between(0, variants.length - 1),
        });
      }
    }
  }

  spawnCandidates
    .sort((a, b) => a.x - b.x)
    .forEach((candidate, index) => {
      const variant =
        variants[candidate.variantIndex] || variants[index % variants.length];

      const coin = coins.create(
        candidate.x,
        candidate.tileTop,
        variant.textureKey
      ) as Phaser.Physics.Arcade.Sprite;

      coin.setDepth(8);
      coin.setScale(2);
      coin.setData("healPercent", variant.healPercent);

      const desiredY =
        candidate.tileTop - coin.displayHeight / 2 - tileHeight * 0.15;
      const clampedY = Math.max(coin.displayHeight * 0.5, desiredY);
      coin.setY(clampedY);

      coin.play(variant.animationKey, true);
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
    });
}

export function createCoinPickupHandler(
  scene: Phaser.Scene,
  healthController: LocalHealthController,
  onCollect?: (coinId: string) => void
): Phaser.Types.Physics.Arcade.ArcadePhysicsCallback {
  return (_player, coinObject) => {
    const coin = coinObject as Phaser.Physics.Arcade.Sprite;
    if (!coin || !coin.active) {
      return;
    }

    const coinId = coin.getData("coinId");
    const pickupX = coin.x;
    const pickupY = coin.y;

    coin.disableBody(true, true);

    // Notify server about collection (server will handle heal)
    if (onCollect && coinId) {
      onCollect(coinId);
    } else {
      // Fallback for local-only mode (offline)
      const healPercentRaw = coin.getData("healPercent");
      const healPercent =
        typeof healPercentRaw === "number" ? healPercentRaw : 0.1;
      healthController.addHealthPercent(healPercent);
    }

    const sparkle = scene.add.circle(pickupX, pickupY, 14, 0xffe066, 0.7);
    sparkle.setDepth(9);
    scene.tweens.add({
      targets: sparkle,
      alpha: 0,
      scale: 2,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => sparkle.destroy(),
    });
  };
}

function findGroundTile(
  groundLayer: Phaser.Tilemaps.TilemapLayer,
  column: number
): Phaser.Tilemaps.Tile | null {
  const layerHeight = groundLayer.layer.height;
  for (let row = layerHeight - 1; row >= 0; row--) {
    const tile = groundLayer.getTileAt(column, row);
    if (tile && tile.collides) {
      if (row > 0) {
        const above = groundLayer.getTileAt(column, row - 1);
        if (above && above.collides) {
          continue;
        }
      }
      return tile;
    }
  }

  return null;
}
