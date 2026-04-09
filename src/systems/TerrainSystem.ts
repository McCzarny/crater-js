import Phaser from 'phaser';
import { CONFIG } from '../config';
import WorldGenerator from './WorldGenerator';
import ItemManager from './ItemManager';
import { TileRegistry, type Tile } from './TileTypes';

/**
 * Interface for ladder data
 */
interface LadderData {
  isVine: boolean;
}

/**
 * Type for environment reaction handlers
 */
type ReactionHandler = (changedX: number, changedY: number) => void;

/**
 * TerrainSystem - manages world terrain, rendering, and modification
 * Now uses composition with WorldGenerator and ItemManager for better separation of concerns
 */
export default class TerrainSystem {
  scene: Phaser.Scene;
  blocks: Tile[][];
  blockSprites: Map<string, Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite>;
  ladders: Map<string, LadderData>;
  ladderSprites: Map<string, Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite>;
  container: Phaser.GameObjects.Container;
  itemManager: ItemManager;
  reactionHandlers: ReactionHandler[];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.blocks = [];
    this.blockSprites = new Map();

    // Ladder (vine) tracking system
    this.ladders = new Map(); // key: 'x,y', value: { sprite, createdBy }
    this.ladderSprites = new Map();

    // Create a container for all block sprites
    this.container = scene.add.container(0, 0);

    // Initialize item manager
    this.itemManager = new ItemManager(scene, this);

    // Initialize tile registry
    TileRegistry.initialize();

    // Environment reaction handlers (for flexible future reactions)
    // Handlers are called with (changedX, changedY)
    this.reactionHandlers = [];
    // Register built-in boulder reaction
    this.reactionHandlers.push(this._boulderReaction.bind(this));
  }

  /**
   * Generate the game world
   */
  generateWorld(): void {
    // Use WorldGenerator pipeline to create the block data
    const generator = new WorldGenerator();
    const ctx = generator.generate();
    this.blocks = ctx.blocks;

    // Render the world
    this.renderWorld();

    // Spawn items queued by generation stages (e.g. cave loot)
    for (const item of ctx.pendingItems) {
      this.itemManager.spawnItem(item.gridX, item.gridY, item.type);
    }
  }

  /**
   * Render the entire world
   */
  renderWorld(): void {
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
        this.renderBlock(x, y);
      }
    }
  }

  /**
   * Render a single block
   */
  renderBlock(x: number, y: number): void {
    const block = this.blocks[y][x];
    const key = `${x},${y}`;

    // Remove existing sprite if any
    if (this.blockSprites.has(key)) {
      this.blockSprites.get(key)!.destroy();
      this.blockSprites.delete(key);
    }

    // Don't render air blocks or blocks without color/textureVariants
    if (!block.color && !(block.textureVariants && block.textureVariants.length)) {
      return;
    }

    const pixelX = x * CONFIG.BLOCK_SIZE;
    const pixelY = y * CONFIG.BLOCK_SIZE;

    let spriteOrGraphics: Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite;
    // If tile has texture variants, pick one randomly (and cache it on the block instance)
    if (block.textureVariants && block.textureVariants.length) {
      if (!block.chosenTexture) {
        const idx = Math.floor(Math.random() * block.textureVariants.length);
        block.chosenTexture = block.textureVariants[idx];
      }
      const texKey = block.chosenTexture;
      if (texKey && this.scene.textures.exists(texKey)) {
        spriteOrGraphics = this.scene.add.sprite(
          pixelX + CONFIG.BLOCK_SIZE / 2,
          pixelY + CONFIG.BLOCK_SIZE / 2,
          texKey,
        );
        spriteOrGraphics.setDisplaySize(CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
        spriteOrGraphics.setDepth(10);
      } else if (block.color) {
        // Fallback to color if texture missing
        spriteOrGraphics = this.scene.add.graphics();
        spriteOrGraphics.fillStyle(block.color, 1);
        spriteOrGraphics.fillRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
        spriteOrGraphics.lineStyle(1, 0x000000, 0.2);
        spriteOrGraphics.strokeRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
        spriteOrGraphics.setPosition(pixelX, pixelY);
      } else {
        return; // No texture and no color fallback
      }
    } else {
      // No texture variants: render as colored rectangle
      spriteOrGraphics = this.scene.add.graphics();
      spriteOrGraphics.fillStyle(block.color!, 1);
      spriteOrGraphics.fillRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
      spriteOrGraphics.lineStyle(1, 0x000000, 0.2);
      spriteOrGraphics.strokeRect(0, 0, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
      spriteOrGraphics.setPosition(pixelX, pixelY);
    }

    this.blockSprites.set(key, spriteOrGraphics);
    this.container.add(spriteOrGraphics);
  }

  /**
   * Get the block at the given grid position
   */
  getBlockAt(gridX: number, gridY: number): Tile | null {
    if (gridX < 0 || gridX >= CONFIG.WORLD_WIDTH || gridY < 0 || gridY >= CONFIG.WORLD_HEIGHT) {
      return null;
    }

    return this.blocks[gridY][gridX];
  }

  /**
   * Mine/remove a block at the given grid position
   */
  mineBlockAt(gridX: number, gridY: number): boolean | null {
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
    // Notify environment reaction handlers so things like boulders can react
    this.handleEnvironmentAfterChange(gridX, gridY);

    return true;
  }

  /**
   * Call registered reaction handlers when a block at (x,y) changed.
   * Handlers may perform changes to blocks; they should call renderBlock
   * for any coordinates they modify.
   */
  handleEnvironmentAfterChange(changedX: number, changedY: number): void {
    for (const handler of this.reactionHandlers) {
      try {
        handler(changedX, changedY);
      } catch (err) {
        console.error('Error in reaction handler:', err);
      }
    }
  }

  /**
   * Built-in reaction: if a block above a changed cell is a boulder and the
   * changed cell is not solid, make the boulder fall one tile down.
   */
  _boulderReaction(changedX: number, changedY: number): void {
    const aboveY = changedY - 1;
    if (aboveY < 0) {
      return;
    }

    const aboveBlock = this.getBlockAt(changedX, aboveY);
    const targetBlock = this.getBlockAt(changedX, changedY);

    if (!aboveBlock || !targetBlock) {
      return;
    }

    // If above is a boulder and the current block is not solid, let the boulder fall
    // until it lands on a solid block or reaches the bottom.
    const BOULDER_KEY = 'boulder';
    if (aboveBlock.type === TileRegistry.getTile(BOULDER_KEY).type && !targetBlock.solid) {
      const fallFromY = aboveY;
      let landingY = fallFromY;

      // Search downward for landing position
      while (landingY + 1 < CONFIG.WORLD_HEIGHT) {
        const below = this.getBlockAt(changedX, landingY + 1);
        if (!below || !below.solid) {
          landingY++;
        } else {
          break;
        }
      }

      // If landing position is same as origin, nothing to do
      if (landingY === fallFromY) {
        return;
      }

      // Move boulder to landingY and clear original position
      const boulderTile = TileRegistry.createTile(BOULDER_KEY);
      boulderTile.minedType = this.getBlockAt(changedX, fallFromY)!.minedType; // Preserve minedType for boulder
      const removedBoulderTile = TileRegistry.createTile(aboveBlock.minedType || 'air');

      this.blocks[landingY][changedX] = boulderTile;
      this.blocks[fallFromY][changedX] = removedBoulderTile;

      // Destroy all items at the landing tile
      this.itemManager.removeAllItemsAt(changedX, landingY);

      // Re-render the column area affected (from original above down to landing)
      for (let y = fallFromY; y <= landingY; y++) {
        this.renderBlock(changedX, y);
      }

      // Notify further reactions after boulder has moved
      this.handleEnvironmentAfterChange(changedX, aboveY);
    }
  }

  /**
   * Get items at a specific grid position
   */
  getItemsAt(gridX: number, gridY: number) {
    return this.itemManager.getItemsAt(gridX, gridY);
  }

  /**
   * Remove an item from the ground
   */
  removeItem(itemId: string) {
    return this.itemManager.removeItem(itemId);
  }

  /**
   * Spawn an item at a grid position
   */
  spawnItem(gridX: number, gridY: number, itemType: string): void {
    this.itemManager.spawnItem(gridX, gridY, itemType);
  }

  /**
   * Update items (apply gravity)
   */
  updateItems(time: number): void {
    this.itemManager.updateItems(time);
  }

  /**
   * Check if a ladder(vine) exists at the given position
   */
  hasLadder(gridX: number, gridY: number): boolean {
    const key = `${gridX},${gridY}`;
    const exists = this.ladders.has(key);
    return exists;
  }

  /**
   * Add a ladder at the given position
   */
  addLadder(gridX: number, gridY: number, isVine: boolean = false): boolean {
    const key = `${gridX},${gridY}`;

    // Don't add if already exists
    if (this.ladders.has(key)) {
      console.log('Ladder already exists at:', gridX, gridY);
      return false;
    }

    // Don't add vines on solid blocks
    const block = this.getBlockAt(gridX, gridY);
    if (block && block.solid) {
      console.log('Cannot add ladder on solid block at:', gridX, gridY);
      return false;
    }

    // Store ladder data
    this.ladders.set(key, { isVine });
    console.log('Ladder added at:', gridX, gridY, 'Total ladders:', this.ladders.size);

    // Render the ladder (vine)
    try {
      this.renderLadder(gridX, gridY, isVine);
    } catch (error) {
      console.error('Error rendering ladder:', error);
      // Remove ladder data if rendering failed
      this.ladders.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a ladder at the given position
   */
  removeLadder(gridX: number, gridY: number): boolean {
    const key = `${gridX},${gridY}`;

    if (!this.ladders.has(key)) {
      return false;
    }

    // Remove ladder data
    this.ladders.delete(key);

    // Remove ladder sprite
    if (this.ladderSprites.has(key)) {
      this.ladderSprites.get(key)!.destroy();
      this.ladderSprites.delete(key);
    }

    return true;
  }

  /**
   * Render a ladder (vine) sprite at the given position
   */
  renderLadder(gridX: number, gridY: number, isVine: boolean = false): void {
    const key = `${gridX},${gridY}`;

    // Remove existing sprite if any
    if (this.ladderSprites.has(key)) {
      this.ladderSprites.get(key)!.destroy();
    }

    const pixelX = gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    const pixelY = gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    const textureKey = isVine ? 'vine' : 'ladder';

    // Create vine sprite
    const vineSprite = this.scene.add
      .sprite(pixelX, pixelY, textureKey)
      .setDisplaySize(CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE)
      .setDepth(500); // Between blocks and characters

    this.ladderSprites.set(key, vineSprite);
    console.log('Ladder sprite rendered at:', gridX, gridY);
  }

  /**
   * Get ladder (vine) at the given position
   */
  getLadder(gridX: number, gridY: number): LadderData | null {
    const key = `${gridX},${gridY}`;
    return this.ladders.get(key) || null;
  }

  /**
   * Check if a block is solid at the given world position (legacy method)
   */
  isSolid(worldX: number, worldY: number): boolean {
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
  getBlock(worldX: number, worldY: number): Tile | null {
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
  mineBlock(worldX: number, worldY: number): boolean | null {
    const blockX = Math.floor(worldX / CONFIG.BLOCK_SIZE);
    const blockY = Math.floor(worldY / CONFIG.BLOCK_SIZE);
    return this.mineBlockAt(blockX, blockY);
  }
}
