import Phaser from 'phaser';
import { makeIcon, IconReturn } from './ui-commons';
import type { ICharacter } from '../types/game-types';

type Character = ICharacter;

// Frame indices in current_action spritesheet (top-to-bottom)
const ACTION_FRAME = {
  idle: 0,
  walking: 1,
  mining: 2,
  ability: 3,
  searching: 4,
} as const;

export default class CharacterIcons {
  scene: Phaser.Scene;
  options: Record<string, unknown>;
  icons: IconReturn[];
  borders: Phaser.GameObjects.Rectangle[];
  actionIndicators: Phaser.GameObjects.Sprite[];
  activeIndex: number;

  constructor(scene: Phaser.Scene, options: Record<string, unknown> = {}) {
    this.scene = scene;
    this.options = options;
    this.icons = [];
    this.borders = [];
    this.actionIndicators = [];
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
    // Remove old icons, borders and action indicators
    this.icons.forEach(ic => {
      ic.bg.destroy();
      if (ic.label) {
        ic.label.destroy();
      }
    });
    this.borders.forEach(b => b.destroy());
    this.actionIndicators.forEach(s => s.destroy());
    this.icons = [];
    this.borders = [];
    this.actionIndicators = [];

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

      // Action indicator: 14×14 sprite in the top-right corner of the icon
      const indicator = this.scene.add
        .sprite(x + 20, y - 20, 'current_action', this.getActionFrame(char))
        .setScrollFactor(0)
        .setDepth(202);

      this.icons.push(icon);
      this.borders.push(border);
      this.actionIndicators.push(indicator);
    }
  }

  private getActionFrame(char: Character): number {
    if (char.isDead) { return ACTION_FRAME.idle; }
    if (char.mining?.isMining || char.mining?.isAutoDigging) { return ACTION_FRAME.mining; }
    if (char.abilities.anyAbilityActive()) { return ACTION_FRAME.ability; }
    if (char.inventory?.isSearching) { return ACTION_FRAME.searching; }
    if (char.movement?.isMoving) { return ACTION_FRAME.walking; }
    return ACTION_FRAME.idle;
  }

  updateActionIndicators(characters: Character[]): void {
    characters.forEach((char, i) => {
      const indicator = this.actionIndicators[i];
      if (indicator) {
        indicator.setFrame(this.getActionFrame(char));
      }
    });
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
    this.actionIndicators.forEach(s => s.destroy());
    this.icons = [];
    this.borders = [];
    this.actionIndicators = [];
  }
}
