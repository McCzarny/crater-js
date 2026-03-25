import { createPanel } from './ui-commons.js';

export default class PointsUI {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
  }

  create(x, y) {
    const width = this.options.width || 180;
    const height = this.options.height || 48;

    this.panel = createPanel(this.scene, x, y, width, height, 0x113311, 0.9, 205);

    this.label = this.scene.add
      .text(x, y, `Points: ${this.options.points || 0}`, {
        fontSize: '16px',
        color: '#ffff88',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(206);
  }

  setPoints(val) {
    if (this.label) {
      this.label.setText(`Points: ${val}`);
    }
  }

  destroy() {
    if (this.panel) {
      this.panel.destroy();
    }
    if (this.label) {
      this.label.destroy();
    }
  }
}
