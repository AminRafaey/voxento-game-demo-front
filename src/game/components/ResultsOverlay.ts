import Phaser from "phaser";

type RankingEntry = {
  label: string;
  rank: number;
  result: string;
  isLocal: boolean;
};

interface ResultsOverlayOptions {
  winnerLabel: string | null;
  rankings: RankingEntry[];
  timeExpired: boolean;
}

export default class ResultsOverlay {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly rankingsText: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    this.background = scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    );
    this.background.setOrigin(0.5);

    this.panel = scene.add.rectangle(
      width / 2,
      height / 2,
      Math.min(width * 0.75, 920),
      Math.min(height * 0.55, 420),
      0x0d1224,
      0.95
    );
    this.panel.setOrigin(0.5);
    this.panel.setStrokeStyle(3, 0xffd166, 0.9);

    this.titleText = scene.add.text(width / 2, height / 2 - 110, "", {
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
    });
    this.titleText.setOrigin(0.5);

    this.subtitleText = scene.add.text(width / 2, height / 2 - 60, "", {
      fontSize: "22px",
      color: "#d9e1ff",
      align: "center",
    });
    this.subtitleText.setOrigin(0.5);

    this.rankingsText = scene.add.text(width / 2, height / 2 + 10, "", {
      fontSize: "20px",
      color: "#f1f3ff",
      align: "center",
      fontFamily: "monospace",
      lineSpacing: 6,
    });
    this.rankingsText.setOrigin(0.5, 0);

    this.container = scene.add.container(0, 0, [
      this.background,
      this.panel,
      this.titleText,
      this.subtitleText,
      this.rankingsText,
    ]);
    this.container.setDepth(1800);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  show(options: ResultsOverlayOptions) {
    const { winnerLabel, rankings, timeExpired } = options;

    const headline = winnerLabel
      ? `${winnerLabel} wins!`
      : timeExpired
      ? "Time's up!"
      : "Race Complete";

    this.titleText.setText(headline);

    if (timeExpired && !winnerLabel) {
      this.subtitleText.setText("No one finished before the timer expired.");
    } else if (timeExpired) {
      this.subtitleText.setText(
        "Timer expired — remaining runners marked as Time Up."
      );
    } else {
      this.subtitleText.setText("Final rankings");
    }

    if (rankings.length === 0) {
      this.rankingsText.setText("No ranking data available.");
    } else {
      const lines = rankings.map((entry) => {
        const place = `${entry.rank}`.padStart(2, "0");
        const youMarker = entry.isLocal ? " (you)" : "";
        const resultLabel = this.prettyResult(entry.result);
        return `${place}. ${entry.label}${youMarker} — ${resultLabel}`;
      });
      this.rankingsText.setText(lines.join("\n"));
    }

    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy(true);
  }

  private prettyResult(result: string) {
    switch (result) {
      case "winner":
        return "Winner";
      case "finished":
        return "Finished";
      case "timeout":
        return "Time Up";
      case "lost":
        return "Lost";
      default:
        return result || "Pending";
    }
  }
}
