import { CONFIG } from '../config.js';

/**
 * Tile Type Enum - centralized tile type definitions
 */
export const TileType = {
  AIR: 'air',
  GRASS: 'grass',
  DIRT: 'dirt',
  MINED_DIRT: 'minedDirt',
  STONE: 'stone',
  MINED_STONE: 'minedStone',
  IRON_STONE: 'ironStone',
  MINED_IRON_STONE: 'minedIronStone',
  DEEP_STONE: 'deepStone',
  MINED_DEEP_STONE: 'minedDeepStone',
  RARE_ORE: 'rareOre',
  MINED_RARE_ORE: 'minedRareOre',
  BOULDER: 'boulder',
};

/**
 * Tile Class - represents a single tile with all its properties
 */
export class Tile {
  constructor(type, solid, color, breakable = true, minedType = null, texture = null) {
    this.type = type;
    this.solid = solid;
    this.color = color;
    this.breakable = breakable;
    this.minedType = minedType;
    this.texture = texture;
  }

  /**
   * Create a copy of this tile
   */
  clone() {
    return new Tile(
      this.type,
      this.solid,
      this.color,
      this.breakable,
      this.minedType,
      this.texture
    );
  }

  /**
   * Get the mined version of this tile
   */
  getMinedTile() {
    if (!this.minedType) {
      return TileRegistry.getTile(TileType.AIR);
    }
    return TileRegistry.getTile(this.minedType);
  }
}

/**
 * Helper function to darken a color
 */
function darkenColor(color, factor = 0.6) {
  const r = ((color >> 16) & 0xff) * factor;
  const g = ((color >> 8) & 0xff) * factor;
  const b = (color & 0xff) * factor;
  return ((r << 16) | (g << 8) | b) >>> 0;
}

/**
 * Tile Registry - centralized tile definitions and lookup
 */
export class TileRegistry {
  static tiles = new Map();

  /**
   * Initialize all tile definitions
   */
  static initialize() {
    // Air - not solid, not breakable
    this.register(new Tile(TileType.AIR, false, null, false, null));

    // Grass - solid, not breakable
    this.register(new Tile(TileType.GRASS, true, 0x3a7d3a, false, null));

    // Dirt - solid, breakable, has mined version
    this.register(
      new Tile(TileType.DIRT, true, CONFIG.LAYERS.DIRT.color, true, TileType.MINED_DIRT, 'dirt')
    );

    // Mined Dirt - not solid, not breakable (already mined)
    this.register(
      new Tile(
        TileType.MINED_DIRT,
        false,
        darkenColor(CONFIG.LAYERS.DIRT.color),
        false,
        null,
        'mined_dirt'
      )
    );

    // Stone - solid, breakable, has mined version
    this.register(
      new Tile(TileType.STONE, true, CONFIG.LAYERS.STONE.color, true, TileType.MINED_STONE, 'stone')
    );

    // Mined Stone - not solid, not breakable
    this.register(
      new Tile(
        TileType.MINED_STONE,
        false,
        darkenColor(CONFIG.LAYERS.STONE.color),
        false,
        null,
        'mined_stone'
      )
    );

    // Iron Stone - solid, breakable, has mined version
    this.register(
      new Tile(
        TileType.IRON_STONE,
        true,
        CONFIG.LAYERS.IRON.color,
        true,
        TileType.MINED_IRON_STONE,
        'iron_stone'
      )
    );

    // Mined Iron Stone - not solid, not breakable
    this.register(
      new Tile(
        TileType.MINED_IRON_STONE,
        false,
        darkenColor(CONFIG.LAYERS.IRON.color),
        false,
        null,
        'mined_iron_stone'
      )
    );

    // Deep Stone - solid, breakable, has mined version
    this.register(
      new Tile(
        TileType.DEEP_STONE,
        true,
        CONFIG.LAYERS.DEEP_STONE.color,
        true,
        TileType.MINED_DEEP_STONE,
        'deep_stone'
      )
    );

    // Mined Deep Stone - not solid, not breakable
    this.register(
      new Tile(
        TileType.MINED_DEEP_STONE,
        false,
        darkenColor(CONFIG.LAYERS.DEEP_STONE.color),
        false,
        null,
        'mined_deep_stone'
      )
    );

    // Rare Ore - solid, breakable, has mined version
    this.register(
      new Tile(
        TileType.RARE_ORE,
        true,
        CONFIG.LAYERS.RARE_ORE.color,
        true,
        TileType.MINED_RARE_ORE,
        'rare_ore'
      )
    );

    // Mined Rare Ore - not solid, not breakable
    this.register(
      new Tile(
        TileType.MINED_RARE_ORE,
        false,
        darkenColor(CONFIG.LAYERS.RARE_ORE.color),
        false,
        null,
        'mined_rare_ore'
      )
    );

    // Boulder - solid, not breakable
    this.register(new Tile(TileType.BOULDER, true, 0x616262, false, null, 'boulder'));

    // NOTE: To add a texture for a tile, add the texture file to resources/tiles/ and reference its key here.
    // The texture key should match the name used in BootScene preload (e.g., 'stone', 'dirt', etc.).

    console.log('TileRegistry: Initialized with', this.tiles.size, 'tile types');
  }

  /**
   * Register a tile type
   */
  static register(tile) {
    this.tiles.set(tile.type, tile);
  }

  /**
   * Get a tile definition by type
   */
  static getTile(type) {
    const tile = this.tiles.get(type);
    if (!tile) {
      console.warn(`TileRegistry: Tile type '${type}' not found, returning air`);
      return this.tiles.get(TileType.AIR);
    }
    return tile;
  }

  /**
   * Create a new tile instance (clone) by type
   */
  static createTile(type) {
    return this.getTile(type).clone();
  }

  /**
   * Check if a tile type exists
   */
  static hasTile(type) {
    return this.tiles.has(type);
  }
}
