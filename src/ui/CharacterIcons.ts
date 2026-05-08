import Phaser from 'phaser';
import { makeIcon, IconReturn } from './ui-commons';
import type { ICharacter } from '../types/game-types';
import type TooltipManager from './TooltipManager';

type Character = ICharacter;

// Frame indices in current_action spritesheet (top-to-bottom)
const ACTION_FRAME = {
  idle: 0,
  dead: 1,
  walking: 2,
  mining: 3,
  ability: 4,
  searching: 5,
} as const;

export default class CharacterIcons {
  scene: Phaser.Scene;
  options: Record<string, unknown>;
  icons: IconReturn[];
  borders: Phaser.GameObjects.Rectangle[];
  actionIndicators: Phaser.GameObjects.Sprite[];
  traitIcons: Phaser.GameObjects.GameObject[];
  activeIndex: number;
  tooltipManager?: TooltipManager;

  constructor(scene: Phaser.Scene, options: Record<string, unknown> = {}) {
    this.scene = scene;
    this.options = options;
    this.icons = [];
    this.borders = [];
    this.actionIndicators = [];
    this.traitIcons = [];
    this.activeIndex = 0;

    this.scene.scene.get('GameScene').events.on('switchCharacter', (index: number) => {
      this.activeIndex = index;
      this.borders.forEach((b, i) => b.setVisible(i === index));
    });
  }

  setTooltipManager(tooltipManager: TooltipManager): void {
    this.tooltipManager = tooltipManager;
  }

  /**
   * Create or update icons for the given character list.
   * @param characters - Array of characters
   * @param x - X position
   * @param startY - Starting Y position
   * @param spacing - Spacing between icons
   */
  update(characters: Character[], x: number = 30, startY: number = 30, spacing: number = 60): void {
    // Remove old icons, borders, action indicators, and trait icons
    this.icons.forEach(ic => {
      ic.bg.destroy();
      if (ic.label) {
        ic.label.destroy();
      }
    });
    this.borders.forEach(b => b.destroy());
    this.actionIndicators.forEach(s => s.destroy());
    this.traitIcons.forEach(o =>
      (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy(),
    );
    this.icons = [];
    this.borders = [];
    this.actionIndicators = [];
    this.traitIcons = [];

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

      // Trait icons: small squares to the right of the character icon.
      // Up to TRAITS_PER_COL per column, additional columns grow rightward.
      const traits = char.traits?.traits ?? [];
      const traitIconSize = 16;
      const traitGap = 2;
      const traitStep = traitIconSize + traitGap;
      const TRAITS_PER_COL = 3;
      const traitStartX = x + 36;
      const traitStartY = y - 16; // align to top of the icon area
      traits.forEach((trait, ti) => {
        const col = Math.floor(ti / TRAITS_PER_COL);
        const row = ti % TRAITS_PER_COL;
        const tx = traitStartX + col * traitStep;
        const ty = traitStartY + row * traitStep;
        const square = this.scene.add
          .rectangle(tx, ty, traitIconSize, traitIconSize, 0x446688, 1)
          .setScrollFactor(0)
          .setDepth(202)
          .setInteractive({ useHandCursor: false });
        const letter = this.scene.add
          .text(tx, ty, trait.name[0].toUpperCase(), {
            fontSize: '10px',
            color: '#ffffff',
            fontFamily: 'monospace',
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(203);
        if (this.tooltipManager) {
          this.tooltipManager.registerTooltip(square, {
            title: trait.name,
            description: [trait.description],
          });
        }
        this.traitIcons.push(square, letter);
      });
    }
  }

  private getActionFrame(char: Character): number {
    if (char.isDead) {
      return ACTION_FRAME.dead;
    }
    if (char.mining?.isMining || char.mining?.isAutoDigging) {
      return ACTION_FRAME.mining;
    }
    if (char.abilities.anyAbilityActive()) {
      return ACTION_FRAME.ability;
    }
    if (char.inventory?.isSearching) {
      return ACTION_FRAME.searching;
    }
    if (char.movement?.isMoving) {
      return ACTION_FRAME.walking;
    }
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
    this.traitIcons.forEach(o =>
      (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy(),
    );
    this.icons = [];
    this.borders = [];
    this.actionIndicators = [];
    this.traitIcons = [];
  }
}
