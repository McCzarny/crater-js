import Phaser from 'phaser';
import { createPanel, makeItemIcon, makePortrait, ItemIconReturn } from './ui-commons';
import type TooltipManager from './TooltipManager';
import { CONFIG, getItemConfig } from '../config';
import type { ICharacter } from '../types/game-types';

const PANEL_DEPTH = 210;
const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 360;

interface SellSlot {
  itemIcon: ItemIconReturn;
  valueLabel: Phaser.GameObjects.Text;
  sellBtn: Phaser.GameObjects.Text;
}

export default class TradeUI {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private panel!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Sprite;
  private playerEssenceLabel!: Phaser.GameObjects.Text;
  private sellSlots: SellSlot[] = [];
  private buyBtn!: Phaser.GameObjects.Text;
  private tooltipManager?: TooltipManager;

  // Runtime state updated on refresh
  private currentInventory: (string | null)[] = [];
  private currentEssence: number = 0;
  private currentMaxEssence: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(cx: number, cy: number): void {
    const x = cx;
    const y = cy;
    const left = x - PANEL_WIDTH / 2;
    const top = y - PANEL_HEIGHT / 2;

    // --- Background panel ---
    this.panel = createPanel(
      this.scene,
      x,
      y,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      0x1a1a2e,
      0.95,
      PANEL_DEPTH,
    );
    this.elements.push(this.panel);

    // --- Trader portrait (left side) ---
    this.portrait = makePortrait(this.scene, left + 60, top + 60, 'trader_portrait');
    this.portrait.setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    this.elements.push(this.portrait);

    // --- Title ---
    const title = this.scene.add
      .text(left + 140, top + 16, 'Trader', {
        fontSize: '18px',
        color: '#f0d060',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.elements.push(title);

    // --- Close button ---
    const closeBtn = this.scene.add
      .text(x + PANEL_WIDTH / 2 - 24, top + 12, '✕', {
        fontSize: '16px',
        color: '#ff8888',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.scene.game.events.emit('closeTrade');
    });
    this.elements.push(closeBtn);

    // --- Divider ---
    const divider = this.scene.add
      .rectangle(x, top + 90, PANEL_WIDTH - 20, 1, 0x555555, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setOrigin(0.5, 0.5);
    this.elements.push(divider);

    // --- SELL section ---
    const sellLabel = this.scene.add
      .text(left + 140, top + 100, 'SELL', {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.elements.push(sellLabel);

    // 4 sell slots in a row starting at x = left + 140
    const sellStartX = left + 160;
    const sellY = top + 140;
    const slotSpacing = 90;
    this.sellSlots = [];

    for (let i = 0; i < CONFIG.MAX_ITEMS; i++) {
      const slotX = sellStartX + i * slotSpacing;

      const itemIcon = makeItemIcon(this.scene, slotX, sellY);
      itemIcon.bg.setDepth(PANEL_DEPTH + 1);
      itemIcon.image.setDepth(PANEL_DEPTH + 2).setVisible(false);

      const valueLabel = this.scene.add
        .text(slotX, sellY + 28, '', {
          fontSize: '10px',
          color: '#f0d060',
          fontFamily: 'monospace',
        })
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2)
        .setOrigin(0.5, 0);
      this.elements.push(valueLabel);

      const sellBtn = this.scene.add
        .text(slotX, sellY + 42, 'Sell', {
          fontSize: '11px',
          color: '#60e060',
          fontFamily: 'monospace',
          backgroundColor: '#224422',
          padding: { x: 4, y: 2 },
        })
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2)
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);

      const slotIndex = i;
      sellBtn.on('pointerdown', () => {
        const gameScene = this.scene.scene.get('GameScene');
        if (gameScene) {
          gameScene.events.emit('sellItem', slotIndex);
        }
      });

      this.elements.push(itemIcon.bg, itemIcon.image, sellBtn);
      this.sellSlots.push({ itemIcon, valueLabel, sellBtn });
    }

    // --- Divider 2 ---
    const divider2 = this.scene.add
      .rectangle(x, top + 205, PANEL_WIDTH - 20, 1, 0x555555, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setOrigin(0.5, 0.5);
    this.elements.push(divider2);

    // --- BUY section ---
    const buyLabel = this.scene.add
      .text(left + 140, top + 215, 'BUY', {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.elements.push(buyLabel);

    // Ladder row
    const ladderX = sellStartX;
    const ladderY = top + 255;
    const ladderIcon = makeItemIcon(this.scene, ladderX, ladderY);
    ladderIcon.bg.setDepth(PANEL_DEPTH + 1);
    ladderIcon.image
      .setDepth(PANEL_DEPTH + 2)
      .setTexture(CONFIG.ITEMS.LADDER.texture)
      .setVisible(true);
    this.elements.push(ladderIcon.bg, ladderIcon.image);

    const ladderNameText = this.scene.add
      .text(ladderX + 36, ladderY - 10, CONFIG.ITEMS.LADDER.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.elements.push(ladderNameText);

    const ladderDescText = this.scene.add
      .text(ladderX + 36, ladderY + 6, CONFIG.ITEMS.LADDER.description, {
        fontSize: '10px',
        color: '#888888',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.elements.push(ladderDescText);

    const ladderCostText = this.scene.add
      .text(ladderX + 36, ladderY + 20, `Cost: ${CONFIG.ITEMS.LADDER.baseValue} essence`, {
        fontSize: '10px',
        color: '#f0d060',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.elements.push(ladderCostText);

    this.buyBtn = this.scene.add
      .text(ladderX + 200, ladderY, 'Buy', {
        fontSize: '13px',
        color: '#60e060',
        fontFamily: 'monospace',
        backgroundColor: '#224422',
        padding: { x: 6, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2)
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });

    this.buyBtn.on('pointerdown', () => {
      const gameScene = this.scene.scene.get('GameScene');
      if (gameScene) {
        gameScene.events.emit('buyItem', 'LADDER');
      }
    });
    this.elements.push(this.buyBtn);

    // --- Player essence display ---
    this.playerEssenceLabel = this.scene.add
      .text(x, top + PANEL_HEIGHT - 18, 'Your Essence: ?', {
        fontSize: '11px',
        color: '#aaaaff',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setOrigin(0.5, 1);
    this.elements.push(this.playerEssenceLabel);

    // Start hidden
    this.setVisible(false);
  }

  setTooltipManager(tooltipManager: TooltipManager): void {
    this.tooltipManager = tooltipManager;
  }

  open(player: ICharacter): void {
    this.currentInventory = player.inventory
      ? [...player.inventory.inventory]
      : Array(CONFIG.MAX_ITEMS).fill(null);
    this.currentEssence = player.essence ?? 0;
    this.currentMaxEssence = player.maxEssence ?? 0;
    this.setVisible(true);
    this.refreshAll();
  }

  close(): void {
    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.panel?.visible ?? false;
  }

  refreshInventory(inventory: (string | null)[]): void {
    if (!this.isOpen) {
      return;
    }

    this.currentInventory = [...inventory];
    this.refreshAll();
  }

  refreshEssence(essence: number, maxEssence: number): void {
    if (!this.isOpen) {
      return;
    }

    this.currentEssence = essence;
    this.currentMaxEssence = maxEssence;
    this.refreshAll();
  }

  private refreshAll(): void {
    const inventory = this.currentInventory;
    const essence = this.currentEssence;
    const maxEssence = this.currentMaxEssence;
    const essenceFull = essence >= maxEssence;

    // Refresh sell slots
    for (let i = 0; i < this.sellSlots.length; i++) {
      const slot = this.sellSlots[i];
      const itemType = inventory[i] ?? null;
      const resourceConfig = itemType ? getItemConfig(itemType) : null;

      if (resourceConfig) {
        slot.itemIcon.image.setTexture(resourceConfig.texture).setVisible(true);
        slot.valueLabel.setText(`+${resourceConfig.baseValue}`).setVisible(true);
        slot.sellBtn.setVisible(true);
        // Disable sell if essence would overflow
        if (essenceFull) {
          slot.sellBtn.setColor('#888888').setInteractive({ useHandCursor: false });
        } else {
          slot.sellBtn.setColor('#60e060').setInteractive({ useHandCursor: true });
        }
      } else {
        slot.itemIcon.image.setVisible(false);
        slot.valueLabel.setVisible(false);
        slot.sellBtn.setVisible(false);
      }
    }

    // Refresh buy button
    const hasEmptySlot = this.currentInventory.some(s => s === null);
    const canAfford = essence >= CONFIG.ITEMS.LADDER.baseValue;
    if (hasEmptySlot && canAfford) {
      this.buyBtn.setColor('#60e060').setInteractive({ useHandCursor: true });
    } else {
      this.buyBtn.setColor('#888888').setInteractive({ useHandCursor: false });
    }

    // Update essence label
    this.playerEssenceLabel.setText(`Your Essence: ${essence} / ${maxEssence}`);
  }

  setVisible(visible: boolean): void {
    this.elements.forEach(el => {
      (el as unknown as Phaser.GameObjects.Components.Visible)?.setVisible(visible);
    });
  }

  destroy(): void {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
    this.sellSlots = [];
  }
}
