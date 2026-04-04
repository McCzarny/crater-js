import Phaser from 'phaser';
import { makeIcon, IconReturn } from './ui-commons';
import type { ICharacter } from '../types/game-types';

type Character = ICharacter;

export default class CharacterIcons {
  scene: Phaser.Scene;
  options: Record<string, unknown>;
  icons: IconReturn[];
  borders: Phaser.GameObjects.Rectangle[];
  activeIndex: number;

  constructor(scene: Phaser.Scene, options: Record<string, unknown> = {}) {
    this.scene = scene;
    this.options = options;
    this.icons = [];
    this.borders = [];
    this.activeIndex = 0;
  }

  /**
   * Create or update icons for the given character list.
   * @param characters - Array of characters
   * @param x - X position
   * @param startY - Starting Y position
   * @param spacing - Spacing between icons
   */
  update(characters: Character[], x: number = 30, startY: number = 30, spacing: number = 60): void {
    // Remove old icons and borders
    this.icons.forEach(ic => {
      ic.bg.destroy();
      if (ic.label) {
        ic.label.destroy();
      }
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

  select(index: number): void {
    this.activeIndex = index;
    this.borders.forEach((b, i) => b.setVisible(i === index));

    // Emit event for external listeners
    if (this.scene && this.scene.scene) {
      this.scene.scene.get('GameScene').events.emit('switchCharacter', index);
    }
  }

  destroy(): void {
    this.icons.forEach(ic => {
      ic.bg.destroy();
      if (ic.label) {
        ic.label.destroy();
      }
    });
    this.borders.forEach(b => b.destroy());
    this.icons = [];
    this.borders = [];
  }
}
