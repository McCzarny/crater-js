import Phaser from 'phaser';
import { CONFIG, getBaseItemConfig } from '../config';
import { TileType, type TileTypeValue } from './TileTypes';
import type TerrainSystem from './TerrainSystem';
import TooltipManager from '../ui/TooltipManager';

/**
 * Interface for items on the ground
 */
interface Item {
  gridX: number;
  gridY: number;
  type: string;
  id: string;
}

/**
 * ItemManager - handles item spawning, rendering, gravity, and collection
 */
export default class ItemManager {
  scene: Phaser.Scene;
  terrainSystem: TerrainSystem;
  items: Item[];
  itemSprites: Map<string, Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite>;
  itemContainer: Phaser.GameObjects.Container;
  lastItemGravityUpdate: number;
  itemGravityInterval: number;
  tooltipManager: TooltipManager;

  constructor(scene: Phaser.Scene, terrainSystem: TerrainSystem) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;

    // Items on the ground
    this.items = [];
    this.itemSprites = new Map();

    // Create container for item sprites
    this.itemContainer = scene.add.container(0, 0);
    this.itemContainer.setDepth(500); // Above blocks, below character

    // Item gravity settings
    this.lastItemGravityUpdate = 0;
    this.itemGravityInterval = 100; // Check gravity every 100ms

    // Tooltip manager for item hover tooltips
    this.tooltipManager = new TooltipManager(scene, 200);
    this.tooltipManager.tooltip.container.setScrollFactor(0);
  }

  /**
   * Remove all items at a specific grid position
   */
  removeAllItemsAt(gridX: number, gridY: number): void {
    // Collect IDs of items at the given position
    const itemsToRemove = this.items.filter(item => item.gridX === gridX && item.gridY === gridY);
    for (const item of itemsToRemove) {
      this.removeItem(item.id);
    }
  }

  /**
   * Get essence type for a given amount
   */
  getEssenceTypeForAmount(amount: number): keyof typeof CONFIG.ESSENCE {
    if (amount <= CONFIG.ESSENCE.ESSENCE_GRAIN.max_value) {
      return 'ESSENCE_GRAIN';
    } else if (amount <= CONFIG.ESSENCE.ESSENCE_LUMP.max_value) {
      return 'ESSENCE_LUMP';
    } else if (amount <= CONFIG.ESSENCE.ESSENCE_CHUNK.max_value) {
      return 'ESSENCE_CHUNK';
    } else {
      return 'ESSENCE_CORE';
    }
  }

  /**
   * Try to drop an item at the given position based on block type
   */
  tryDropItem(gridX: number, gridY: number, blockType: TileTypeValue): void {
    const possibleItems: Partial<Record<string, number>> = {};

    // Determine drop chances based on block type
    switch (blockType) {
      case TileType.DIRT:
        possibleItems['COAL'] = 0.02;
        break;
      case TileType.STONE:
        possibleItems['COAL'] = 0.05;
        possibleItems['EMERALD'] = 0.02;
        break;
      case TileType.IRON_STONE:
        possibleItems['EMERALD'] = 0.08;
        break;
      case TileType.DEEP_STONE:
        possibleItems['EMERALD'] = 0.05;
        possibleItems['AMETHYST'] = 0.02;
        possibleItems['DIAMOND'] = 0.01;
        break;
      case TileType.RARE_ORE:
        possibleItems['EMERALD'] = 0.06;
        possibleItems['AMETHYST'] = 0.04;
        possibleItems['DIAMOND'] = 0.02;
        break;
    }

    // Roll for drop
    const itemTypes = Object.keys(possibleItems);
    if (itemTypes.length > 0) {
      for (const itemType of itemTypes) {
        if (Math.random() < (possibleItems[itemType] || 0)) {
          this.spawnItem(gridX, gridY, itemType);
          return; // Only drop one item per block
        }
      }
    }

    // Additionally, drop essence based on depth
    const essenceChance = Math.min(Math.pow(gridY / CONFIG.WORLD_HEIGHT, 2), 0.1);

    if (Math.random() < essenceChance) {
      const essenceAmount = essenceChance * CONFIG.MAX_ESSENCE_DROP;
      if (essenceAmount > 0) {
        const essenceType = this.getEssenceTypeForAmount(essenceAmount);
        if (essenceType) {
          this.spawnItem(gridX, gridY, essenceType);
          return;
        }
      }
    }
  }

  /**
   * Spawn an item at the given grid position
   */
  spawnItem(gridX: number, gridY: number, itemType: string): void {
    const item: Item = {
      gridX: gridX,
      gridY: gridY,
      type: itemType,
      id: `item_${Date.now()}_${Math.random()}`,
    };

    this.items.push(item);
    this.renderItem(item);

    console.log('Item spawned:', itemType, 'at', gridX, gridY);
  }

  /**
   * Render an item sprite
   */
  renderItem(item: Item): void {
    const config = getBaseItemConfig(item.type);

    const pixelX = item.gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    const pixelY = item.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    // Create a smaller diamond/gem shape
    const size = CONFIG.BLOCK_SIZE;

    const sprite = this.scene.add.sprite(pixelX, pixelY, config.texture);
    sprite.setDisplaySize(size, size);
    sprite.setDepth(500);

    this.itemSprites.set(item.id, sprite);
    this.itemContainer.add(sprite);

    // Make item interactive and register tooltip
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
      Phaser.Geom.Rectangle.Contains,
    );
    const tooltipContent = this.getItemTooltipContent(item.type);
    this.tooltipManager.registerTooltip(sprite, tooltipContent);
  }

  /**
   * Get tooltip content for an item type
   */
  private getItemTooltipContent(itemType: string): {
    title: string;
    icon?: string;
    description: string[];
  } {
    const resourceConfig = CONFIG.RESOURCES[itemType as keyof typeof CONFIG.RESOURCES];
    if (resourceConfig) {
      const name = itemType.charAt(0) + itemType.slice(1).toLowerCase();
      return {
        title: name,
        icon: resourceConfig.texture,
        description: [`Value: ${resourceConfig.baseValue} essence`],
      };
    }

    const essenceConfig = CONFIG.ESSENCE[itemType as keyof typeof CONFIG.ESSENCE];
    if (essenceConfig) {
      const name = itemType
        .split('_')
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
      return {
        title: name,
        icon: essenceConfig.texture,
        description: ['Essence'],
      };
    }

    return { title: itemType, description: [] };
  }

  /**
   * Get items at a specific grid position
   */
  getItemsAt(gridX: number, gridY: number): Item[] {
    return this.items.filter(item => item.gridX === gridX && item.gridY === gridY);
  }

  /**
   * Remove an item from the ground
   */
  removeItem(itemId: string): Item | null {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      const item = this.items[index];
      this.items.splice(index, 1);

      // Remove sprite
      if (this.itemSprites.has(itemId)) {
        this.itemSprites.get(itemId)!.destroy();
        this.itemSprites.delete(itemId);
      }

      return item;
    }
    return null;
  }

  /**
   * Update item positions (apply gravity)
   */
  updateItems(time: number): void {
    // Only update at intervals
    if (time - this.lastItemGravityUpdate < this.itemGravityInterval) {
      return;
    }

    this.lastItemGravityUpdate = time;

    // Process items for gravity
    for (const item of this.items) {
      this.applyItemGravity(item);
    }
  }

  /**
   * Apply gravity to a single item
   */
  applyItemGravity(item: Item): void {
    // Check if we're at the bottom
    if (item.gridY >= CONFIG.WORLD_HEIGHT - 1) {
      return;
    }

    // Check if there's a solid block below
    const blockBelow = this.terrainSystem.getBlockAt(item.gridX, item.gridY + 1);

    if (!blockBelow || !blockBelow.solid) {
      // Move item down
      item.gridY++;

      // Update sprite position
      const sprite = this.itemSprites.get(item.id);
      if (sprite) {
        const newPixelY = item.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
        sprite.setPosition(sprite.x, newPixelY);
      }
    }
  }
}
