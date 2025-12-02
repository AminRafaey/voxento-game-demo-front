import Phaser from "phaser";
import { Room } from "colyseus.js";
import { MyRoomState, Player } from "../../types/state.types";
import NameLabel from "./NameLabel";

interface LocalHealthControllerOptions {
  healthText: Phaser.GameObjects.Text;
  moveCost: number;
  moveCostInterval: number;
  room?: Room<MyRoomState>;
}

interface MovementCostResult {
  blocked: boolean;
  consumed: boolean;
}

export default class LocalHealthController {
  private room?: Room<MyRoomState>;
  private label?: NameLabel;
  private labelBase = "";
  private maxHealth = 1000;
  private health = 1000;
  private lastHorizontalCostTime = 0;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly moveCost: number;
  private readonly moveCostInterval: number;

  constructor(
    private readonly scene: Phaser.Scene,
    options: LocalHealthControllerOptions
  ) {
    this.healthText = options.healthText;
    this.moveCost = options.moveCost;
    this.moveCostInterval = options.moveCostInterval;
    this.room = options.room;
    this.refreshUI();
  }

  setRoom(room: Room<MyRoomState>) {
    this.room = room;
  }

  attachLabel(label: NameLabel, base: string) {
    this.label = label;
    this.labelBase = base;
    this.refreshUI();
  }

  clearLabel() {
    this.label = undefined;
    this.labelBase = "";
  }

  initializeFromState(playerState: Player) {
    this.applyState(playerState);
  }

  applyState(playerState: Player) {
    if (typeof playerState.maxHealth === "number") {
      this.maxHealth = Math.max(1, Math.floor(playerState.maxHealth));
    }

    if (typeof playerState.health === "number") {
      this.health = Math.max(0, Math.min(this.maxHealth, playerState.health));
    }

    if (this.health <= 0) {
      this.lastHorizontalCostTime = 0;
    }

    this.refreshUI();
  }

  canMove(): boolean {
    return this.health > 0;
  }

  handleHorizontalInput(
    time: number,
    pressed: boolean,
    held: boolean
  ): MovementCostResult {
    if (!this.canMove()) {
      return { blocked: true, consumed: false };
    }

    let blocked = false;
    let consumed = false;

    if (pressed) {
      const spent = this.consume(this.moveCost);
      if (spent) {
        consumed = true;
        this.lastHorizontalCostTime = time;
      } else {
        blocked = true;
      }
    }

    if (!blocked && held) {
      if (this.health < this.moveCost) {
        blocked = true;
      } else if (
        this.lastHorizontalCostTime > 0 &&
        time - this.lastHorizontalCostTime >= this.moveCostInterval
      ) {
        const spent = this.consume(this.moveCost);
        if (spent) {
          consumed = true;
          this.lastHorizontalCostTime = time;
        } else {
          blocked = true;
        }
      } else if (this.lastHorizontalCostTime === 0) {
        // Player started holding without triggering pressed (e.g., from state sync)
        this.lastHorizontalCostTime = time;
      }
    }

    if (!held) {
      this.lastHorizontalCostTime = 0;
    }

    return { blocked, consumed };
  }

  handleJumpRequest(
    _time: number,
    alreadyConsumed: boolean
  ): MovementCostResult {
    if (!this.canMove()) {
      return { blocked: true, consumed: false };
    }

    if (alreadyConsumed) {
      return { blocked: false, consumed: false };
    }

    const spent = this.consume(this.moveCost);
    if (!spent) {
      return { blocked: true, consumed: false };
    }

    return { blocked: false, consumed: true };
  }

  update() {
    this.healthText.setPosition(this.scene.cameras.main.width - 56, 16);
  }

  addHealth(amount: number, notifyServer = true) {
    const healAmount = Math.max(0, Math.floor(amount));
    if (healAmount <= 0) {
      return;
    }

    const previousHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + healAmount);

    if (this.health === previousHealth) {
      return;
    }

    this.refreshUI();

    if (notifyServer) {
      this.room?.send("heal", { amount: healAmount });
    }
  }

  addHealthPercent(percent: number, notifyServer = true) {
    const normalizedPercent = percent > 1 ? percent / 100 : percent;
    if (!Number.isFinite(normalizedPercent) || normalizedPercent <= 0) {
      return;
    }

    const healAmount = Math.round(this.maxHealth * normalizedPercent);
    this.addHealth(healAmount, notifyServer);
  }

  private consume(amount: number): boolean {
    const required = Math.max(0, Math.floor(amount));
    if (required <= 0) {
      return true;
    }

    if (this.health < required) {
      return false;
    }

    this.health = Math.max(0, this.health - required);
    if (this.health <= 0) {
      this.lastHorizontalCostTime = 0;
    }

    this.refreshUI();
    this.room?.send("move-cost", { amount: required });
    return true;
  }

  private refreshUI() {
    const percent =
      this.maxHealth > 0 ? (this.health / this.maxHealth) * 1000 : 0;
    const clamped = Math.max(0, Math.min(1000, Math.round(percent)));

    this.healthText.setText(`Health: ${clamped}%`);
    this.healthText.setPosition(this.scene.cameras.main.width - 56, 16);

    if (this.label && this.labelBase) {
      this.label.setText(`${this.labelBase} • ${clamped}%`);
    }
  }
}
