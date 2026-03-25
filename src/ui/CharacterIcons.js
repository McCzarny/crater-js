import { makeIcon } from './ui-commons.js';

export default class CharacterIcons {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.icons = [];
    this.borders = [];
    this.activeIndex = 0;
  }

  create(x = 30, startY = 30, spacing = 60) {
    const races = this.options.races || ['C1', 'C2', 'C3'];

    for (let i = 0; i < races.length; i++) {
      const y = startY + i * spacing;
      const icon = makeIcon(this.scene, x, y, 48, races[i]);
      icon.bg.setInteractive({ useHandCursor: true });

      icon.bg.on('pointerdown', () => {
        this.select(i);
      });

      icon.bg.on('pointerover', () => icon.bg.setScale(1.05));
      icon.bg.on('pointerout', () => icon.bg.setScale(1));

      const border = this.scene.add
        .rectangle(x, y, 56, 56, 0xffff00, 0.4)
        .setScrollFactor(0)
        .setDepth(199)
        .setVisible(i === 0);

      this.icons.push(icon);
      this.borders.push(border);
    }
  }

  select(index) {
    this.activeIndex = index;
    this.borders.forEach((b, i) => b.setVisible(i === index));

    // Emit event for external listeners
    if (this.scene && this.scene.scene) {
      this.scene.scene.get('GameScene').events.emit('switchCharacter', index);
    }
  }

  destroy() {
    this.icons.forEach(ic => {
      ic.bg.destroy();
      ic.label.destroy();
    });
    this.borders.forEach(b => b.destroy());
    this.icons = [];
    this.borders = [];
  }
}
