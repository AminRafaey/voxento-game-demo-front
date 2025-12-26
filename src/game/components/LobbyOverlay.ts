import Phaser from "phaser";

interface LobbyOverlayOptions {
  title: string;
  message: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

export default class LobbyOverlay {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly messageText: Phaser.GameObjects.Text;
  private readonly countdownText: Phaser.GameObjects.Text;
  private buttonText?: Phaser.GameObjects.Text;
  private currentHandler?: () => void;
  private isVisible = false;
  private fadeInTween?: Phaser.Tweens.Tween;
  private fadeOutTween?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    this.background = scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.55
    );
    this.background.setOrigin(0.5);

    this.panel = scene.add.rectangle(
      width / 2,
      height / 2,
      Math.min(width * 0.7, 840),
      Math.min(height * 0.45, 360),
      0x10132c,
      0.92
    );
    this.panel.setOrigin(0.5);
    this.panel.setStrokeStyle(2, 0x5c7aff, 0.85);

    this.titleText = scene.add.text(width / 2, height / 2 - 90, "", {
      fontSize: "30px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
    });
    this.titleText.setOrigin(0.5);

    this.messageText = scene.add.text(width / 2, height / 2 - 20, "", {
      fontSize: "22px",
      color: "#dde1ff",
      align: "center",
      wordWrap: { width: Math.min(width * 0.6, 760) },
    });
    this.messageText.setOrigin(0.5, 0.5);

    this.countdownText = scene.add.text(width / 2, height / 2 + 50, "", {
      fontSize: "20px",
      color: "#a8b5ff",
      fontStyle: "italic",
      align: "center",
    });
    this.countdownText.setOrigin(0.5);

    this.container = scene.add.container(0, 0, [
      this.background,
      this.panel,
      this.titleText,
      this.messageText,
      this.countdownText,
    ]);
    this.container.setDepth(1500);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
    this.container.setAlpha(0);
  }

  show(options: LobbyOverlayOptions, animate = true) {
    if (this.isVisible) {
      // Just update content if already visible
      this.updateContent(options);
      return;
    }

    this.updateContent(options);
    this.isVisible = true;
    this.container.setVisible(true);

    // Cancel any ongoing fade out
    this.fadeOutTween?.stop();

    if (animate) {
      this.fadeInTween = this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 250,
        ease: "Cubic.easeOut",
      });
    } else {
      this.container.setAlpha(1);
    }
  }

  hide(animate = true) {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Cancel any ongoing fade in
    this.fadeInTween?.stop();

    if (animate) {
      this.fadeOutTween = this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 200,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.container.setVisible(false);
        },
      });
    } else {
      this.container.setAlpha(0);
      this.container.setVisible(false);
    }
  }

  private updateContent(options: LobbyOverlayOptions) {
    this.titleText.setText(options.title);
    this.messageText.setText(options.message);
    this.setCountdown(undefined);

    if (options.buttonText) {
      this.ensureButton();
      this.buttonText!.setText(options.buttonText);
      this.buttonText!.setVisible(true);
      this.attachHandler(options.onButtonClick);
    } else if (this.buttonText) {
      this.buttonText.setVisible(false);
      this.attachHandler(undefined);
    }
  }

  setCountdown(value?: number) {
    if (typeof value === "number" && value > 0) {
      this.countdownText.setText(`Game time: ${value}s`);
      this.countdownText.setVisible(true);
    } else {
      this.countdownText.setVisible(false);
    }
  }

  destroy() {
    this.fadeInTween?.stop();
    this.fadeOutTween?.stop();
    this.attachHandler(undefined);
    this.container.destroy(true);
  }

  isShowing(): boolean {
    return this.isVisible;
  }

  private ensureButton() {
    if (this.buttonText) {
      return;
    }

    const { width, height } = this.scene.scale;
    this.buttonText = this.scene.add.text(width / 2, height / 2 + 110, "", {
      fontSize: "24px",
      backgroundColor: "#1e5aff",
      color: "#ffffff",
      fontStyle: "bold",
      padding: { x: 24, y: 12 },
      align: "center",
    });
    this.buttonText.setOrigin(0.5);
    this.buttonText.setDepth(1501);
    this.buttonText.setScrollFactor(0);
    this.buttonText.setInteractive({ useHandCursor: true });

    this.buttonText
      .on("pointerover", () =>
        this.buttonText?.setStyle({ backgroundColor: "#2d72ff" })
      )
      .on("pointerout", () =>
        this.buttonText?.setStyle({ backgroundColor: "#1e5aff" })
      );

    this.container.add(this.buttonText);
  }

  private attachHandler(handler?: () => void) {
    if (!this.buttonText) {
      return;
    }

    if (this.currentHandler) {
      this.buttonText.off("pointerdown", this.currentHandler);
    }

    this.currentHandler = handler;
    if (handler) {
      // Add click animation effect
      const wrappedHandler = () => {
        // Disable button temporarily to prevent double-clicks
        this.buttonText?.disableInteractive();

        // Button press animation
        this.scene.tweens.add({
          targets: this.buttonText,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 75,
          yoyo: true,
          ease: "Cubic.easeInOut",
          onComplete: () => {
            handler();
            // Re-enable after a short delay
            this.scene.time.delayedCall(300, () => {
              this.buttonText?.setInteractive({ useHandCursor: true });
            });
          },
        });
      };

      this.buttonText.on("pointerdown", wrappedHandler);
      this.buttonText.setAlpha(1);
      this.buttonText.setInteractive({ useHandCursor: true });
    } else {
      this.buttonText.disableInteractive();
    }
  }
}
