import Phaser from 'phaser';
import { CONFIG } from '../config';
import RegionGenerator, { randomizeModifiers } from './RegionGenerator';
import { selectRegionModifiers, type RegionModifier } from './RegionModifiers';
import ItemManager from './ItemManager';
import { TileRegistry, TileType, type Tile } from './TileTypes';
import EssenceSpider from '../entities/EssenceSpider';
import WormMob from '../entities/WormMob';
import StoneBeetle from '../entities/StoneBeetle';
import type { ICharacter } from '../types/game-types';

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
 * Now uses composition with RegionGenerator and ItemManager for better separation of concerns
 */
export default class TerrainSystem {
  scene: Phaser.Scene;
  blocks: Tile[][];
  tilemapLayer!: Phaser.Tilemaps.TilemapLayer;
  ladders: Map<string, LadderData>;
  ladderSprites: Map<string, Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite>;
  itemManager: ItemManager;
  reactionHandlers: ReactionHandler[];
  /** All active Essence Spiders in the world. */
  spiders: EssenceSpider[] = [];
  /** All active Worm mobs in the world. */
  worms: WormMob[] = [];
  /** All active Stone Beetles in the world. */
  stoneBeetles: StoneBeetle[] = [];
  /** All player characters in the world. Set by GameScene after creation. */
  characters: ICharacter[] = [];
  /** Special modifiers active for this region. Read by GameScene for gameplay effects. */
  activeRegionModifiers: RegionModifier[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.blocks = [];

    // Ladder (vine) tracking system
    this.ladders = new Map(); // key: 'x,y', value: { sprite, createdBy }
    this.ladderSprites = new Map();

    // Initialize item manager
    this.itemManager = new ItemManager(scene, this);

    // Initialize tile registry
    TileRegistry.initialize();

    // Environment reaction handlers (for flexible future reactions)
    // Handlers are called with (changedX, changedY)
    this.reactionHandlers = [];
    // Register built-in boulder reaction
    this.reactionHandlers.push(this._boulderReaction.bind(this));
    // Register stone beetle larva transform reaction
    this.reactionHandlers.push(this._stoneBeetleLarvaReaction.bind(this));
  }

  /**
   * Generate the game world
   */
  generateRegion(): void {
    // Use RegionGenerator pipeline to create the block data
    const specialMods = selectRegionModifiers();
    this.activeRegionModifiers = specialMods;
    const generator = new RegionGenerator(randomizeModifiers(), specialMods);
    const ctx = generator.generate();
    this.blocks = ctx.blocks;

    // Render the world
    this.renderWorld();

    // Spawn items queued by generation stages (e.g. cave loot)
    for (const item of ctx.pendingItems) {
      this.itemManager.spawnItem(item.gridX, item.gridY, item.type);
    }

    // Instantiate Essence Spiders (+ cocoons) from the generation stage
    this.spiders = [];
    for (const s of ctx.pendingSpiders) {
      this.spiders.push(
        new EssenceSpider(this.scene, this, s.spiderX, s.spiderY, s.cocoonX, s.cocoonY),
      );
    }
    console.log(`TerrainSystem: spawned ${this.spiders.length} essence spiders`);

    // Instantiate Worm mobs from the generation stage
    this.worms = [];
    for (const w of ctx.pendingWorms) {
      // If the "writhing" special modifier is active, the first worm is a giant variant.
      const giant =
        this.worms.length === 0 && this.activeRegionModifiers.some(mod => mod.id === 'writhing');
      const worm = new WormMob(this.scene, this, w.x, w.y, giant);
      this.worms.push(worm);
      // Re-clear segment tiles now that the worm is registered as CREATURE-solid,
      // so any boulder that fell onto a segment during construction is removed.
      worm.settle();
    }
    console.log(`TerrainSystem: spawned ${this.worms.length} worms`);

    // Instantiate Stone Beetles from the generation stage
    this.stoneBeetles = [];
    for (const b of ctx.pendingBeetles) {
      this.stoneBeetles.push(new StoneBeetle(this.scene, this, b.x, b.y));
    }
    // Perform initial larva-transform check (a beetle may have spawned adjacent
    // to a cave carved after the beetle stage ran).
    for (const beetle of this.stoneBeetles) {
      beetle.checkTransform();
    }
    console.log(`TerrainSystem: spawned ${this.stoneBeetles.length} stone beetles`);

    // Place ladders queued by the Ruins stage
    for (const pos of ctx.pendingLadders) {
      this.addLadder(pos.gridX, pos.gridY, false);
    }
    if (ctx.pendingLadders.length > 0) {
      console.log(`TerrainSystem: placed ${ctx.pendingLadders.length} ruins ladders`);
    }
  }

  /**
   * Advance spider AI. Call once per frame from GameScene, passing the current
   * list of player characters so spiders can detect and chase them.
   */
  updateSpiders(characters: ICharacter[], time: number, delta: number): void {
    for (const spider of this.spiders) {
      spider.update(characters, time, delta);
    }
  }

  /**
   * Advance worm AI. Call once per frame from GameScene.
   */
  updateWorms(characters: ICharacter[], time: number, delta: number): void {
    for (const worm of this.worms) {
      worm.update(characters, time, delta);
    }
  }

  /**
   * Advance stone beetle AI. Call once per frame from GameScene.
   */
  updateStoneBeetles(characters: ICharacter[], time: number, delta: number): void {
    for (const beetle of this.stoneBeetles) {
      beetle.update(characters, time, delta);
    }
  }

  /**
   * Reaction handler: when a tile changes, check if any adjacent larva beetle
   * should transform to adult form.
   */
  _stoneBeetleLarvaReaction(changedX: number, changedY: number): void {
    for (const beetle of this.stoneBeetles) {
      if (!beetle.isDead && beetle.isLarva) {
        const dx = Math.abs(beetle.gridX - changedX);
        const dy = Math.abs(beetle.gridY - changedY);
        if (dx + dy === 1) {
          beetle.checkTransform();
        }
      }
    }
  }

  /**
   * Render the entire world
   */
  renderWorld(): void {
    const map = this.scene.make.tilemap({
      width: CONFIG.WORLD_WIDTH,
      height: CONFIG.WORLD_HEIGHT,
      tileWidth: CONFIG.BLOCK_SIZE,
      tileHeight: CONFIG.BLOCK_SIZE,
    });
    const tileset = map.addTilesetImage(
      'tiles_atlas',
      'tiles_atlas',
      CONFIG.BLOCK_SIZE,
      CONFIG.BLOCK_SIZE,
      0,
      0,
    );
    this.tilemapLayer = map.createBlankLayer('terrain', tileset!, 0, 0)!;
    this.tilemapLayer.setDepth(10);

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

    const variantCount = block.numberOfVariants();
    if (!variantCount) {
      this.tilemapLayer.removeTileAt(x, y);
      return;
    }

    if (block.variant === null) {
      block.variant = Math.floor(Math.random() * variantCount);
    }

    const atlasIndex = TileRegistry.getBaseAtlasIndex(block.type) + block.variant;
    this.tilemapLayer.putTileAt(atlasIndex, x, y);
  }

  /**
   * Get the block at the given grid position.
   * Returns a CREATURE tile when any creature occupies the cell, so all callers
   * automatically treat creatures as solid without needing explicit creature checks.
   */
  getBlockAt(gridX: number, gridY: number): Tile | null {
    if (gridX < 0 || gridX >= CONFIG.WORLD_WIDTH || gridY < 0 || gridY >= CONFIG.WORLD_HEIGHT) {
      return null;
    }
    if (this.isOccupiedByCreature(gridX, gridY)) {
      return TileRegistry.getTile(TileType.CREATURE);
    }
    return this.blocks[gridY][gridX];
  }

  // Check if a tile is occupied by any creature that should be treated as solid.
  private isOccupiedByCreature(gridX: number, gridY: number): boolean {
    for (const worm of this.worms) {
      if (!worm.isDead && worm.occupiesAt(gridX, gridY)) {
        return true;
      }
    }
    return false;
  }

  /** Returns true if a living larva beetle occupies this cell. */
  isOccupiedByLarva(gridX: number, gridY: number): boolean {
    for (const beetle of this.stoneBeetles) {
      if (!beetle.isDead && beetle.isLarva && beetle.gridX === gridX && beetle.gridY === gridY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Mine/remove a block at the given grid position
   */
  mineBlockAt(gridX: number, gridY: number): boolean | null {
    // Check bounds
    if (gridX < 0 || gridX >= CONFIG.WORLD_WIDTH || gridY < 0 || gridY >= CONFIG.WORLD_HEIGHT) {
      return null;
    }

    // Larva beetles are indestructible — block mining of their cell
    if (this.isOccupiedByLarva(gridX, gridY)) {
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
      const BOULDER_DAMAGE = 1000;
      const hitCharacters: ICharacter[] = [];
      const hitBeetles: StoneBeetle[] = [];

      // Search downward for landing position, stopping at solid blocks, characters, or beetles
      while (landingY + 1 < CONFIG.WORLD_HEIGHT) {
        const nextY = landingY + 1;
        const below = this.getBlockAt(changedX, nextY);
        if (below && below.solid) {
          break;
        }
        // Check if a character occupies the next tile
        const charAtNext = this.characters.find(
          c => !c.isDead && c.gridX === changedX && c.gridY === nextY,
        );
        // Check if an adult beetle occupies the next tile
        const beetleAtNext = this.stoneBeetles.find(
          b => !b.isDead && !b.isLarva && b.gridX === changedX && b.gridY === nextY,
        );
        landingY = nextY;
        if (charAtNext) {
          hitCharacters.push(charAtNext);
          break; // Boulder stops on the character
        }
        if (beetleAtNext) {
          hitBeetles.push(beetleAtNext);
          break; // Boulder stops on the beetle
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

      // Damage characters hit by the boulder
      for (const character of hitCharacters) {
        character.health = Math.max(0, character.health - BOULDER_DAMAGE);
        if (character.health <= 0) {
          character.kill();
        }
      }

      // Damage beetles hit by the boulder
      for (const beetle of hitBeetles) {
        beetle.health = Math.max(0, beetle.health - BOULDER_DAMAGE);
        if (beetle.health <= 0 && !beetle.isDead) {
          beetle.isDead = true;
          this.scene.time.delayedCall(200, () => {
            beetle.destroy();
          });
        }
      }

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
