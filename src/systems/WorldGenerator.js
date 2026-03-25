import { CONFIG } from '../config.js';
import { TileType, TileRegistry } from './TileTypes.js';

/**
 * WorldGenerator - handles world generation logic
 */
export default class WorldGenerator {
  static boulderOrTile(tileType, boulderChance) {
    if (Math.random() < boulderChance) {
      return TileType.BOULDER;
    }
    return tileType;
  }

  /**
   * Generate a single block based on position
   */
  static generateBlock(x, y) {
    // Sky/air blocks
    if (y < CONFIG.SURFACE_HEIGHT) {
      return TileRegistry.createTile(TileType.AIR);
    }

    // Surface layer
    if (y === CONFIG.SURFACE_HEIGHT) {
      return TileRegistry.createTile(TileType.SURFACE);
    }

    // Underground layers
    const depth = y - CONFIG.SURFACE_HEIGHT;
    let tileType = TileType.STONE;
    let layerTileType = TileType.STONE;

    // Determine layer
    if (depth <= 3) {
      tileType = TileType.DIRT; // Top layers are dirt, no boulders
      layerTileType = TileType.DIRT;
    } else if (depth <= CONFIG.LAYERS.DIRT.end) {
      tileType = this.boulderOrTile(TileType.DIRT, 0.05);
      layerTileType = TileType.DIRT;
    } else if (depth <= CONFIG.LAYERS.STONE.end) {
      tileType = this.boulderOrTile(TileType.STONE, 0.1);
      layerTileType = TileType.STONE;
    } else if (depth <= CONFIG.LAYERS.IRON.end) {
      tileType = this.boulderOrTile(TileType.IRON_STONE, 0.15);
      layerTileType = TileType.IRON_STONE;
    } else if (depth <= CONFIG.LAYERS.DEEP_STONE.end) {
      tileType = this.boulderOrTile(TileType.DEEP_STONE, 0.2);
      layerTileType = TileType.DEEP_STONE;
    } else {
      tileType = this.boulderOrTile(TileType.RARE_ORE, 0.25);
      layerTileType = TileType.RARE_ORE;
    }

    // In case it's a boulder, we want to set the minedType.
    const tile = TileRegistry.createTile(tileType);
    tile.minedType = TileRegistry.createTile(layerTileType).minedType;
    return tile;
  }

  /**
   * Generate the complete game world
   */
  static generateWorld() {
    console.log('WorldGenerator: Generating world...');

    const blocks = [];

    // Initialize 2D array for blocks
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
      blocks[y] = [];
      for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
        blocks[y][x] = this.generateBlock(x, y);
      }
    }

    // Create a starting hole in the surface at the center
    const centerX = Math.floor(CONFIG.WORLD_WIDTH / 2);
    const surfaceY = CONFIG.SURFACE_HEIGHT;

    // Make a 3-block wide hole in the surface
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      if (x >= 0 && x < CONFIG.WORLD_WIDTH) {
        blocks[surfaceY][x] = TileRegistry.createTile(TileType.MINED_DIRT);
      }
    }

    console.log('WorldGenerator: World generated with starting hole!');

    return blocks;
  }
}
