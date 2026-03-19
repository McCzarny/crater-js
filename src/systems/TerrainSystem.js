import { CONFIG } from '../config.js';
import WorldGenerator from './WorldGenerator.js';
import ItemManager from './ItemManager.js';
import { TileRegistry } from './TileTypes.js';

/**
 * TerrainSystem - manages world terrain, rendering, and modification
 * Now uses composition with WorldGenerator and ItemManager for better separation of concerns
 */
export default class TerrainSystem {
  constructor(scene) {
    this.scene = scene;
    this.blocks = [];
    this.blockSprites = new Map();

    // Vine tracking system
    this.vines = new Map(); // key: 'x,y', value: { sprite, createdBy }
    this.vineSprites = new Map();

    // Create a container for all block sprites
    this.container = scene.add.container(0, 0);

    // Initialize item manager
    this.itemManager = new ItemManager(scene, this);

    // Initialize tile registry
    TileRegistry.initialize();
  }

  /**
   * Generate the game world
   */
  generateWorld() {
    // Use WorldGenerator to create the block data
    this.blocks = WorldGenerator.generateWorld();

    // Render the world
    this.renderWorld();
  }

  /**
   * Render the entire world
   */
  renderWorld() {
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
        this.renderBlock(x, y);
      }
    }
  }

  /**
   * Render a single block
   */
  renderBlock(x, y) {
    const block = this.blocks[y][x];
    const key = `${x},${y}`;

    // Remove existing sprite if any
    if (this.blockSprites.has(key)) {
      this.blockSprites.get(key).destroy();
      this.blockSprites.delete(key);
    }

    // Don't render air blocks or blocks without color
    if (!block.color) {
      return;
    }

    // Create a rectangle for the block
    const pixelX = x * CONFIG.BLOCK_SIZE;
    const pixelY = y * CONFIG.BLOCK_SIZE;

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(block.color, 1);
    graphics.fillRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);

    // Add a subtle border for visibility
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.strokeRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);

    graphics.setPosition(pixelX, pixelY);

    this.blockSprites.set(key, graphics);
    this.container.add(graphics);
  }

  /**
   * Get the block at the given grid position
   */
  getBlockAt(gridX, gridY) {
    if (gridX < 0 || gridX >= CONFIG.WORLD_WIDTH || gridY < 0 || gridY >= CONFIG.WORLD_HEIGHT) {
      return null;
    }

    return this.blocks[gridY][gridX];
  }

  /**
   * Mine/remove a block at the given grid position
   */
  mineBlockAt(gridX, gridY) {
    // Check bounds
    if (gridX < 0 || gridX >= CONFIG.WORLD_WIDTH || gridY < 0 || gridY >= CONFIG.WORLD_HEIGHT) {
      return null;
    }

    const block = this.blocks[gridY][gridX];

    // Can't mine non-solid blocks or unbreakable blocks
    if (!block.solid || !block.breakable) {
      return null;
    }

    // Store the original block type for item dropping
    const originalType = block.type;

    // Replace block with its mined version
    const minedTile = block.getMinedTile();
    this.blocks[gridY][gridX] = minedTile;

    // Re-render the block (will show mined version or clear if it's air)
    this.renderBlock(gridX, gridY);

    // Try to drop an item based on the original block type
    this.itemManager.tryDropItem(gridX, gridY, originalType);

    return true;
  }

  /**
   * Get items at a specific grid position
   */
  getItemsAt(gridX, gridY) {
    return this.itemManager.getItemsAt(gridX, gridY);
  }

  /**
   * Remove an item from the ground
   */
  removeItem(itemId) {
    return this.itemManager.removeItem(itemId);
  }

  /**
   * Update items (apply gravity)
   */
  updateItems(time) {
    this.itemManager.updateItems(time);
  }

  /**
   * Check if a vine exists at the given position
   */
  hasVine(gridX, gridY) {
    const key = `${gridX},${gridY}`;
    const exists = this.vines.has(key);
    // Only log when checking for movement
    // console.log('Checking vine at:', gridX, gridY, 'exists:', exists);
    return exists;
  }

  /**
   * Add a vine at the given position
   */
  addVine(gridX, gridY, createdBy = null) {
    const key = `${gridX},${gridY}`;

    // Don't add if already exists
    if (this.vines.has(key)) {
      console.log('Vine already exists at:', gridX, gridY);
      return false;
    }

    // Don't add vines on solid blocks
    const block = this.getBlockAt(gridX, gridY);
    if (block && block.solid) {
      console.log('Cannot add vine on solid block at:', gridX, gridY);
      return false;
    }

    // Store vine data
    this.vines.set(key, { createdBy });
    console.log('Vine added at:', gridX, gridY, 'Total vines:', this.vines.size);

    // Render the vine
    try {
      this.renderVine(gridX, gridY);
    } catch (error) {
      console.error('Error rendering vine:', error);
      // Remove vine data if rendering failed
      this.vines.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a vine at the given position
   */
  removeVine(gridX, gridY) {
    const key = `${gridX},${gridY}`;

    if (!this.vines.has(key)) {
      return false;
    }

    // Remove vine data
    this.vines.delete(key);

    // Remove vine sprite
    if (this.vineSprites.has(key)) {
      this.vineSprites.get(key).destroy();
      this.vineSprites.delete(key);
    }

    return true;
  }

  /**
   * Render a vine sprite at the given position
   */
  renderVine(gridX, gridY) {
    const key = `${gridX},${gridY}`;

    // Remove existing sprite if any
    if (this.vineSprites.has(key)) {
      this.vineSprites.get(key).destroy();
    }

    const pixelX = gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    const pixelY = gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    // Check if vine texture exists
    if (!this.scene.textures.exists('vine')) {
      console.error('Vine texture not found! Using placeholder.');
      // Create a placeholder graphic instead
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x00ff00, 0.5);
      graphics.fillRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
      graphics.setPosition(gridX * CONFIG.BLOCK_SIZE, gridY * CONFIG.BLOCK_SIZE);
      graphics.setDepth(500);
      this.vineSprites.set(key, graphics);
      return;
    }

    // Create vine sprite
    const vineSprite = this.scene.add
      .sprite(pixelX, pixelY, 'vine')
      .setDisplaySize(CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE)
      .setDepth(500); // Between blocks and characters

    this.vineSprites.set(key, vineSprite);
    console.log('Vine sprite rendered at:', gridX, gridY);
  }

  /**
   * Get vine at the given position
   */
  getVine(gridX, gridY) {
    const key = `${gridX},${gridY}`;
    return this.vines.get(key) || null;
  }

  /**
   * Check if a block is solid at the given world position (legacy method)
   */
  isSolid(worldX, worldY) {
    const blockX = Math.floor(worldX / CONFIG.BLOCK_SIZE);
    const blockY = Math.floor(worldY / CONFIG.BLOCK_SIZE);

    if (blockX < 0 || blockX >= CONFIG.WORLD_WIDTH || blockY < 0 || blockY >= CONFIG.WORLD_HEIGHT) {
      return true; // Treat out of bounds as solid
    }

    return this.blocks[blockY][blockX].solid;
  }

  /**
   * Get the block at the given world position (legacy method)
   */
  getBlock(worldX, worldY) {
    const blockX = Math.floor(worldX / CONFIG.BLOCK_SIZE);
    const blockY = Math.floor(worldY / CONFIG.BLOCK_SIZE);

    if (blockX < 0 || blockX >= CONFIG.WORLD_WIDTH || blockY < 0 || blockY >= CONFIG.WORLD_HEIGHT) {
      return null;
    }

    return this.blocks[blockY][blockX];
  }

  /**
   * Mine/remove a block at the given world position (legacy method)
   */
  mineBlock(worldX, worldY) {
    const blockX = Math.floor(worldX / CONFIG.BLOCK_SIZE);
    const blockY = Math.floor(worldY / CONFIG.BLOCK_SIZE);
    return this.mineBlockAt(blockX, blockY);
  }
}
