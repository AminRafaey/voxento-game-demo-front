import Phaser from "phaser";
import { tintToColorString } from "../utils/color";

export default class NameLabel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    tint: number
  ) {
    this.text = scene.add.text(x, y, label, {
      fontSize: "14px",
      color: tintToColorString(tint),
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 },
    });
    this.text.setOrigin(0.5, 0);
    this.text.setDepth(1000);
    this.text.setScrollFactor(1);
  }

  setPosition(x: number, y: number) {
    this.text.setPosition(x, y);
  }

  setTint(tint: number) {
    this.text.setColor(tintToColorString(tint));
  }

  setText(label: string) {
    this.text.setText(label);
  }

  setDepth(depth: number) {
    this.text.setDepth(depth);
  }

  destroy() {
    this.text.destroy();
  }

  get displayHeight() {
    return this.text.displayHeight;
  }
}
