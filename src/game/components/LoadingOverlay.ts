import Phaser from "phaser";

export default class LoadingOverlay {
  private background?: Phaser.GameObjects.Rectangle;
  private message?: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {}

  show(initialMessage: string) {
    this.ensureOverlay();
    this.setMessage(initialMessage);
    this.setVisible(true);
  }

  setMessage(text: string) {
    this.ensureOverlay();
    this.message!.setText(text);
  }

  hide() {
    this.setVisible(false);
  }

  destroy() {
    this.background?.destroy();
    this.message?.destroy();
    this.background = undefined;
    this.message = undefined;
  }

  private ensureOverlay() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    if (!this.background) {
      this.background = this.scene.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x000000,
        0.45
      );
      this.background.setOrigin(0.5);
      this.background.setScrollFactor(0);
      this.background.setDepth(2000);
    } else {
      this.background.setSize(width, height);
      this.background.setPosition(width / 2, height / 2);
    }

    if (!this.message) {
      this.message = this.scene.add.text(width / 2, height / 2, "", {
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
      });
      this.message.setOrigin(0.5);
      this.message.setScrollFactor(0);
      this.message.setDepth(2001);
    } else {
      this.message.setPosition(width / 2, height / 2);
    }
  }

  private setVisible(visible: boolean) {
    this.background?.setVisible(visible);
    this.message?.setVisible(visible);
  }
}
