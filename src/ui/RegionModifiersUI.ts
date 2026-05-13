import Phaser from 'phaser';
import { createPanel } from './ui-commons';
import type { RegionModifier } from '../systems/RegionModifiers';
import type TooltipManager from './TooltipManager';

const ICON_SIZE = 26;
const ICON_GAP = 5;

/** Frame indices in the region_modifiers spritesheet, matching pool order. */
const MODIFIER_ICON_FRAMES: Record<string, number> = {
  massive_caves: 0,
  uninhabited: 1,
  essence_drain: 2,
  ruins: 3,
  old_camp: 4,
  infested: 5,
  boulder_field: 6,
  buried_cache: 7,
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

      const frame = MODIFIER_ICON_FRAMES[mod.id] ?? 0;
      const icon = this.scene.add
        .image(iconX, y, 'region_modifiers', frame)
        .setDisplaySize(ICON_SIZE, ICON_SIZE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(207);
      this.objects.push(icon);

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
