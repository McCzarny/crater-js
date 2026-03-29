import { makeIcon } from './ui-commons.js';

export default class CharacterIcons {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.icons = [];
    this.borders = [];
    this.activeIndex = 0;
  }

  /**
   * Create or update icons for the given character list.
   * @param {Array<Character>} characters
   * @param {number} x
   * @param {number} startY
   * @param {number} spacing
   */
  update(characters, x = 30, startY = 30, spacing = 60) {
    // Remove old icons and borders
    this.icons.forEach(ic => {
      ic.bg.destroy();
      ic.label && ic.label.destroy();
    });
    this.borders.forEach(b => b.destroy());
    this.icons = [];
    this.borders = [];

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      const y = startY + i * spacing;
      // Use skull icon if dead, else race
      const iconKey = char.isDead ? 'skull' : char.race;
      const icon = makeIcon(this.scene, x, y, 48, iconKey);
      if (char.isDead) {
        icon.bg.disableInteractive();
        icon.bg.setAlpha(0.5);
      } else {
        icon.bg.setInteractive({ useHandCursor: true });
        icon.bg.on('pointerdown', () => {
          this.select(i);
        });
        icon.bg.on('pointerover', () => icon.bg.setScale(1.05));
        icon.bg.on('pointerout', () => icon.bg.setScale(1));
      }
      const border = this.scene.add
        .rectangle(x, y, 56, 56, 0xffff00, 0.4)
        .setScrollFactor(0)
        .setDepth(199)
        .setVisible(i === this.activeIndex);
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
