import { CONFIG } from '../config';

/**
 * Tile Type Enum - centralized tile type definitions
 */
export const TileType = {
  AIR: 'air',
  SURFACE: 'surface',
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
} as const;

// Type for tile type values
export type TileTypeValue = (typeof TileType)[keyof typeof TileType];

/**
 * Tile Class - represents a single tile with all its properties
 */
export class Tile {
  type: TileTypeValue;
  solid: boolean;
  color: number | null;
  breakable: boolean;
  minedType: TileTypeValue | null;
  /** Chosen variant index (0-based within this tile's variants). Null until first render. */
  variant: number | null;

  constructor(
    type: TileTypeValue,
    solid: boolean,
    color: number | null,
    breakable: boolean = true,
    minedType: TileTypeValue | null = null,
  ) {
    this.type = type;
    this.solid = solid;
    this.color = color;
    this.breakable = breakable;
    this.minedType = minedType;
    this.variant = null;
  }

  /** Number of visual variants available for this tile type. */
  numberOfVariants(): number {
    return TileRegistry.getVariantCount(this.type);
  }

  /**
   * Create a copy of this tile
   */
  clone(): Tile {
    const t = new Tile(this.type, this.solid, this.color, this.breakable, this.minedType);
    t.variant = this.variant;
    return t;
  }

  /**
   * Get the mined version of this tile
   */
  getMinedTile(): Tile {
    if (!this.minedType) {
      return TileRegistry.getTile(TileType.AIR);
    }
    return TileRegistry.getTile(this.minedType);
  }
}

/**
 * Helper function to darken a color
 */
function darkenColor(color: number, factor: number = 0.6): number {
  const r = ((color >> 16) & 0xff) * factor;
  const g = ((color >> 8) & 0xff) * factor;
  const b = (color & 0xff) * factor;
  return ((r << 16) | (g << 8) | b) >>> 0;
}

/**
 * Tile Registry - centralized tile definitions and lookup
 */
export class TileRegistry {
  private static tiles: Map<TileTypeValue, Tile> = new Map();
  private static variantCounts: Map<TileTypeValue, number> = new Map();
  private static baseAtlasIndices: Map<TileTypeValue, number> = new Map();
  private static atlasOffset: number = 0;

  /**
   * Initialize all tile definitions
   */
  static initialize(): void {
    this.tiles.clear();
    this.variantCounts.clear();
    this.baseAtlasIndices.clear();
    this.atlasOffset = 0;

    // Air - not solid, not breakable
    this.register(new Tile(TileType.AIR, false, null, false));
    // Surface - solid, not breakable
    this.register(new Tile(TileType.SURFACE, true, 0x3a7d3a, false), 4);
    // Dirt - solid, breakable
    this.register(
      new Tile(TileType.DIRT, true, CONFIG.LAYERS.DIRT.color, true, TileType.MINED_DIRT),
      4,
    );
    // Mined Dirt
    this.register(
      new Tile(TileType.MINED_DIRT, false, darkenColor(CONFIG.LAYERS.DIRT.color), false),
      1,
    );
    // Stone
    this.register(
      new Tile(TileType.STONE, true, CONFIG.LAYERS.STONE.color, true, TileType.MINED_STONE),
      4,
    );
    // Mined Stone
    this.register(
      new Tile(TileType.MINED_STONE, false, darkenColor(CONFIG.LAYERS.STONE.color), false),
      1,
    );
    // Iron Stone
    this.register(
      new Tile(
        TileType.IRON_STONE,
        true,
        CONFIG.LAYERS.IRON.color,
        true,
        TileType.MINED_IRON_STONE,
      ),
      4,
    );
    // Mined Iron Stone
    this.register(
      new Tile(TileType.MINED_IRON_STONE, false, darkenColor(CONFIG.LAYERS.IRON.color), false),
      1,
    );
    // Deep Stone
    this.register(
      new Tile(
        TileType.DEEP_STONE,
        true,
        CONFIG.LAYERS.DEEP_STONE.color,
        true,
        TileType.MINED_DEEP_STONE,
      ),
      4,
    );
    // Mined Deep Stone
    this.register(
      new Tile(
        TileType.MINED_DEEP_STONE,
        false,
        darkenColor(CONFIG.LAYERS.DEEP_STONE.color),
        false,
      ),
      1,
    );
    // Rare Ore
    this.register(
      new Tile(
        TileType.RARE_ORE,
        true,
        CONFIG.LAYERS.RARE_ORE.color,
        true,
        TileType.MINED_RARE_ORE,
      ),
      4,
    );
    // Mined Rare Ore
    this.register(
      new Tile(TileType.MINED_RARE_ORE, false, darkenColor(CONFIG.LAYERS.RARE_ORE.color), false),
      1,
    );
    // Boulder - solid, not breakable
    this.register(new Tile(TileType.BOULDER, true, 0x616262, false), 1);

    console.log('TileRegistry: Initialized with', this.tiles.size, 'tile types');
  }

  /**
   * Register a tile type. Pass variantCount > 0 to allocate atlas frames for this tile;
   * frames are assigned consecutively starting after the previous tile's frames.
   */
  static register(tile: Tile, variantCount: number = 0): void {
    this.tiles.set(tile.type, tile);
    if (variantCount > 0) {
      this.variantCounts.set(tile.type, variantCount);
      this.baseAtlasIndices.set(tile.type, this.atlasOffset);
      this.atlasOffset += variantCount;
    }
  }

  static getVariantCount(type: TileTypeValue): number {
    return this.variantCounts.get(type) ?? 0;
  }

  static getBaseAtlasIndex(type: TileTypeValue): number {
    return this.baseAtlasIndices.get(type) ?? 0;
  }

  /**
   * Get a tile definition by type
   */
  static getTile(type: TileTypeValue): Tile {
    const tile = this.tiles.get(type);
    if (!tile) {
      console.warn(`TileRegistry: Tile type '${type}' not found, returning air`);
      return this.tiles.get(TileType.AIR)!;
    }
    return tile;
  }

  /**
   * Create a new tile instance (clone) by type
   */
  static createTile(type: TileTypeValue): Tile {
    return this.getTile(type).clone();
  }

  /**
   * Check if a tile type exists
   */
  static hasTile(type: TileTypeValue): boolean {
    return this.tiles.has(type);
  }
}
