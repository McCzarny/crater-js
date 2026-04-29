import Phaser from 'phaser';
import { createPanel } from './ui-commons';

interface EssenceUIOptions {
  essence?: number;
  points?: number;
  goal?: number;
  width?: number;
}

const BAR_WIDTH = 160;
const BAR_HEIGHT = 10;

export default class EssenceUI {
  scene: Phaser.Scene;
  options: EssenceUIOptions;
  panel!: Phaser.GameObjects.Rectangle;
  label!: Phaser.GameObjects.Text;
  barBg!: Phaser.GameObjects.Rectangle;
  barFill!: Phaser.GameObjects.Rectangle;
  private goal: number;

  constructor(scene: Phaser.Scene, options: EssenceUIOptions = {}) {
    this.scene = scene;
    this.options = options;
    this.goal = options.goal ?? 200;
  }

  create(x: number, y: number): void {
    const width = this.options.width || 180;

    this.panel = createPanel(this.scene, x, y, width, 60, 0x113311, 0.9, 205);

    const initial = this.options.points ?? this.options.essence ?? 0;

    this.label = this.scene.add
      .text(x, y - 12, `Unity Pool: ${initial} / ${this.goal}`, {
        fontSize: '13px',
        color: '#ffff88',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(206);

    this.barBg = this.scene.add
      .rectangle(x, y + 14, BAR_WIDTH, BAR_HEIGHT, 0x224422, 1)
      .setScrollFactor(0)
      .setDepth(206)
      .setOrigin(0.5);

    const fillWidth = Math.max(1, Math.min(BAR_WIDTH, (initial / this.goal) * BAR_WIDTH));
    this.barFill = this.scene.add
      .rectangle(x - BAR_WIDTH / 2, y + 14, fillWidth, BAR_HEIGHT, 0xaaee44, 1)
      .setScrollFactor(0)
      .setDepth(207)
      .setOrigin(0, 0.5);
  }

  setEssence(val: number): void {
    if (this.label) {
      this.label.setText(`Unity Pool: ${Math.floor(val)} / ${this.goal}`);
    }
    if (this.barFill) {
      const fillWidth = Math.max(1, Math.min(BAR_WIDTH, (val / this.goal) * BAR_WIDTH));
      this.barFill.setSize(fillWidth, BAR_HEIGHT);
    }
  }

  destroy(): void {
    this.panel?.destroy();
    this.label?.destroy();
    this.barBg?.destroy();
    this.barFill?.destroy();
  }
}
