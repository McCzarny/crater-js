import Phaser from 'phaser';
import { createButton, ButtonElements } from './ui-commons';
import type TooltipManager from './TooltipManager';

const BUTTON_DEPTH = 206;

/**
 * BaseUI - contextual panel shown when the active character is near their race's base.
 * Provides actions that are only available at the base (e.g. Transfer Essence).
 */
export default class BaseUI {
  scene: Phaser.Scene;
  private transferButton!: ButtonElements;
  private tradeButton!: ButtonElements;
  private elements: Phaser.GameObjects.GameObject[];
  private tooltipManager?: TooltipManager;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.elements = [];
  }

  create(x: number, y: number): void {
    this.transferButton = createButton(this.scene, x, y + 10, {
      depth: BUTTON_DEPTH,
      useHandCursor: true,
      icon: 'transfer_essence_icon',
      allowOverlayIcon: false,
    });

    this.transferButton.rect.on('pointerdown', () => {
      const gameScene = this.scene.scene.get('GameScene');
      if (gameScene) {
        gameScene.events.emit('transferEssence');
      }
    });

    this.tradeButton = createButton(this.scene, x + 50, y + 10, {
      depth: BUTTON_DEPTH,
      useHandCursor: true,
      icon: 'trade_icon',
      allowOverlayIcon: false,
    });

    this.tradeButton.rect.on('pointerdown', () => {
      const gameScene = this.scene.scene.get('GameScene');
      if (gameScene) {
        gameScene.events.emit('openTrade');
      }
    });

    if (this.tooltipManager) {
      this.registerTooltips();
    }

    this.elements = [...this.transferButton.getGameObjects(), ...this.tradeButton.getGameObjects()];

    this.setVisible(false);
  }

  setTooltipManager(tooltipManager: TooltipManager): void {
    this.tooltipManager = tooltipManager;
    if (this.transferButton) {
      this.registerTooltips();
    }
  }

  private registerTooltips(): void {
    this.tooltipManager!.registerTooltip(this.transferButton.rect, {
      title: 'Transfer Essence',
      description: ['Transfer essence from the character to the Unity'],
    });
    this.tooltipManager!.registerTooltip(this.tradeButton.rect, {
      title: 'Trade',
      description: ['Open the trader to sell resources and buy items'],
    });
  }

  setVisible(visible: boolean): void {
    this.elements.forEach(el => {
      (el as unknown as Phaser.GameObjects.Components.Visible)?.setVisible(visible);
    });
  }

  destroy(): void {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}
