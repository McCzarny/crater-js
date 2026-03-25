import { CONFIG } from '../config.js';
import { TileType } from './TileTypes.js';

/**
 * ItemManager - handles item spawning, rendering, gravity, and collection
 */
export default class ItemManager {
  constructor(scene, terrainSystem) {
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
  }

  /**
   * Try to drop an item at the given position based on block type
   */
  tryDropItem(gridX, gridY, blockType) {
    const possibleItems = {};

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
        if (Math.random() < possibleItems[itemType]) {
          this.spawnItem(gridX, gridY, itemType);
          break; // Only drop one item per block
        }
      }
    }
  }

  /**
   * Spawn an item at the given grid position
   */
  spawnItem(gridX, gridY, itemType) {
    const item = {
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
  renderItem(item) {
    const config = CONFIG.RESOURCES[item.type];
    if (!config) {
      return;
    }

    const pixelX = item.gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    const pixelY = item.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    // Create a smaller diamond/gem shape
    const size = CONFIG.BLOCK_SIZE;

    // If a texture is defined for this resource and loaded, use it. Otherwise fallback to color graphic.
    if (config.texture && this.scene.textures.exists(config.texture)) {
      const sprite = this.scene.add.sprite(pixelX, pixelY, config.texture);
      sprite.setDisplaySize(size, size);
      sprite.setDepth(500);
      this.itemSprites.set(item.id, sprite);
      this.itemContainer.add(sprite);
    } else {
      const graphics = this.scene.add.graphics();
      const color = config.color || 0xffffff;
      graphics.fillStyle(color, 1);

      // Draw a diamond shape
      graphics.fillTriangle(0, -size / 2, size / 2, 0, 0, size / 2);
      graphics.fillTriangle(0, -size / 2, -size / 2, 0, 0, size / 2);

      // Add a bright border
      graphics.lineStyle(1, 0xffffff, 0.8);
      graphics.strokeTriangle(0, -size / 2, size / 2, 0, 0, size / 2);
      graphics.strokeTriangle(0, -size / 2, -size / 2, 0, 0, size / 2);

      graphics.setPosition(pixelX, pixelY);
      graphics.setDepth(500);

      this.itemSprites.set(item.id, graphics);
      this.itemContainer.add(graphics);
    }
  }

  /**
   * Get items at a specific grid position
   */
  getItemsAt(gridX, gridY) {
    return this.items.filter(item => item.gridX === gridX && item.gridY === gridY);
  }

  /**
   * Remove an item from the ground
   */
  removeItem(itemId) {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      const item = this.items[index];
      this.items.splice(index, 1);

      // Remove sprite
      if (this.itemSprites.has(itemId)) {
        this.itemSprites.get(itemId).destroy();
        this.itemSprites.delete(itemId);
      }

      return item;
    }
    return null;
  }

  /**
   * Update item positions (apply gravity)
   */
  updateItems(time) {
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
  applyItemGravity(item) {
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
