import Phaser from 'phaser';
import { createPanel } from './ui-commons';
import type { RegionModifier } from '../systems/RegionModifiers';
import type TooltipManager from './TooltipManager';

const ICON_SIZE = 26;
const ICON_GAP = 5;

/** Single-character labels shown on each modifier icon (no dedicated textures yet). */
const MODIFIER_ICON_LABELS: Record<string, string> = {
  massive_caves: 'M',
  no_mobs: 'N',
  essence_drain: 'E',
  ruins: 'R',
  old_camp: 'O',
  infested: 'I',
  boulder_field: 'B',
  buried_cache: 'C',
};

export default class RegionModifiersUI {
  private scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(x: number, y: number, modifiers: RegionModifier[], tooltipManager?: TooltipManager): void {
    this.objects.forEach(o =>
      (o as Phaser.GameObjects.GameObject & { destroy: () => void }).destroy(),
    );
    this.objects = [];

    if (modifiers.length === 0) {
      return;
    }

    const panel = createPanel(this.scene, x, y, 180, 38, 0x113311, 0.9, 205);
    this.objects.push(panel);

    const totalIconsWidth = modifiers.length * ICON_SIZE + (modifiers.length - 1) * ICON_GAP;
    const startX = x - totalIconsWidth / 2 + ICON_SIZE / 2;

    for (let i = 0; i < modifiers.length; i++) {
      const mod = modifiers[i];
      const iconX = startX + i * (ICON_SIZE + ICON_GAP);

      const bg = this.scene.add
        .rectangle(iconX, y, ICON_SIZE, ICON_SIZE, 0x2a4430, 1)
        .setScrollFactor(0)
        .setDepth(206)
        .setOrigin(0.5);
      this.objects.push(bg);

      const letter = MODIFIER_ICON_LABELS[mod.id] ?? mod.id.charAt(0).toUpperCase();
      const label = this.scene.add
        .text(iconX, y, letter, {
          fontSize: '14px',
          color: '#88ee88',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(207);
      this.objects.push(label);

      if (tooltipManager) {
        bg.setInteractive();
        tooltipManager.registerTooltip(bg, {
          title: mod.name,
          description: [mod.description],
        });
      }
    }
  }
}
