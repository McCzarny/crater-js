import Phaser from 'phaser';
import { createPanel } from './ui-commons';

interface EssenceUIOptions {
  essence?: number;
  points?: number;
  width?: number;
  height?: number;
}

export default class EssenceUI {
  scene: Phaser.Scene;
  options: EssenceUIOptions;
  panel!: Phaser.GameObjects.Rectangle;
  label!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, options: EssenceUIOptions = {}) {
    this.scene = scene;
    this.options = options;
  }

  create(x: number, y: number): void {
    const width = this.options.width || 180;
    const height = this.options.height || 48;

    this.panel = createPanel(this.scene, x, y, width, height, 0x113311, 0.9, 205);

    this.label = this.scene.add
      .text(x, y, `Essence: ${this.options.essence || 0}`, {
        fontSize: '16px',
        color: '#ffff88',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(206);
  }

  setEssence(val: number): void {
    if (this.label) {
      this.label.setText(`Essence: ${val}`);
    }
  }

  destroy(): void {
    if (this.panel) {
      this.panel.destroy();
    }
    if (this.label) {
      this.label.destroy();
    }
  }
}
