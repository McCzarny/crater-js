/**
 * Game configuration constants with TypeScript types
 */

import { BaseItem, TradableConfig } from './types/game-types';

// Layer configuration
interface LayerConfig {
  start: number;
  end: number;
  color: number;
}

// Resource types
type ResourceConfig = TradableConfig;

// Essence types
interface EssenceConfig extends BaseItem {
  min_value: number;
  max_value: number;
}

// Race configuration
interface RaceConfig {
  name: string;
  id: string;
  description: string;
  miningSpeedMultiplier: number;
  movementSpeedMultiplier: number;
  staminaLimit: number;
  patienceLimit: number;
  healthLimit: number;
  essenceLimit: number;
  /** Damage dealt per hit. */
  attackPower: number;
  /** Milliseconds between attacks. */
  attackInterval: number;
  /** Essence drained from unity pool per minute while alive. */
  upkeepPerMinute: number;
  /** HP damage per second applied when the unity pool is empty. */
  upkeepDamagePerSecond: number;
}

// Main configuration interface
interface GameConfig {
  // Display settings
  GAME_WIDTH: number;
  GAME_HEIGHT: number;
  PIXEL_SCALE: number;

  // World settings
  WORLD_WIDTH: number;
  WORLD_HEIGHT: number;
  BLOCK_SIZE: number;

  // Surface settings
  SURFACE_HEIGHT: number;

  // Base settings
  BASE_SIZE: number;

  // Layer depths
  LAYERS: {
    DIRT: LayerConfig;
    STONE: LayerConfig;
    IRON: LayerConfig;
    DEEP_STONE: LayerConfig;
    RARE_ORE: LayerConfig;
  };

  // Resource types
  RESOURCES: {
    COAL: ResourceConfig;
    DIAMOND: ResourceConfig;
    EMERALD: ResourceConfig;
    AMETHYST: ResourceConfig;
  };

  ESSENCE: {
    ESSENCE_GRAIN: EssenceConfig;
    ESSENCE_LUMP: EssenceConfig;
    ESSENCE_CHUNK: EssenceConfig;
    ESSENCE_CORE: EssenceConfig;
  };

  MAX_ESSENCE_DROP: number;

  // Unity pool (level goal)
  UNITY_ESSENCE_GOAL: number;
  UNITY_ESSENCE_INITIAL: number;

  // Shop items
  ITEMS: {
    LADDER: TradableConfig;
  };

  // Race definitions
  RACES: {
    tribe: RaceConfig;
    fungus: RaceConfig;
    petal: RaceConfig;
  };

  // Character settings (base stats)
  CHAR_SPEED: number;
  CHAR_JUMP_VELOCITY: number;
  CHAR_SIZE: number;
  MINING_RANGE: number;
  MINING_TIME: number;
  MAX_HEALTH: number;
  MAX_ITEMS: number;

  // Physics
  GRAVITY: number;

  // UI Colors
  UI_BACKGROUND: number;
  UI_TEXT_COLOR: string;
}

export const CONFIG: GameConfig = {
  // Display settings
  GAME_WIDTH: 1024,
  GAME_HEIGHT: 768,
  PIXEL_SCALE: 1, // Pixel scale multiplier (1 = normal, 2 = 2x2 pixels, etc.)

  // World settings
  WORLD_WIDTH: 50, // Width in blocks
  WORLD_HEIGHT: 150, // Height in blocks
  BLOCK_SIZE: 32, // Pixel size of each block

  // Surface settings
  SURFACE_HEIGHT: 10, // Blocks from top

  // Base settings
  BASE_SIZE: 3, // Bases are 3x3 tiles

  // Layer depths (in blocks from surface)
  LAYERS: {
    DIRT: { start: 0, end: 15, color: 0x8b7355 },
    STONE: { start: 15, end: 40, color: 0x666666 },
    IRON: { start: 40, end: 70, color: 0x8b5a3c },
    DEEP_STONE: { start: 70, end: 100, color: 0x444444 },
    RARE_ORE: { start: 100, end: 150, color: 0x3a3a5c },
  },

  // Resource types
  RESOURCES: {
    COAL: {
      baseValue: 5,
      texture: 'coal',
      name: 'Coal',
      description: 'Basic fuel source',
      usable: false,
    },
    DIAMOND: {
      baseValue: 100,
      texture: 'diamond',
      name: 'Diamond',
      description: 'Precious gemstone',
      usable: false,
    },
    EMERALD: {
      baseValue: 75,
      texture: 'emerald',
      name: 'Emerald',
      description: 'Valuable green gem',
      usable: false,
    },
    AMETHYST: {
      baseValue: 90,
      texture: 'amethyst',
      name: 'Amethyst',
      description: 'Purple gemstone',
      usable: false,
    },
  },
  ESSENCE: {
    ESSENCE_GRAIN: {
      name: 'Essence Grain',
      description: 'Small amount of essence',
      min_value: 1,
      max_value: 10,
      texture: 'essence_grain',
    },
    ESSENCE_LUMP: {
      name: 'Essence Lump',
      description: 'Moderate amount of essence',
      min_value: 10,
      max_value: 25,
      texture: 'essence_lump',
    },
    ESSENCE_CHUNK: {
      name: 'Essence Chunk',
      description: 'Large amount of essence',
      min_value: 25,
      max_value: 50,
      texture: 'essence_chunk',
    },
    ESSENCE_CORE: {
      name: 'Essence Core',
      description: 'Very large amount of essence',
      min_value: 50,
      max_value: 100,
      texture: 'essence_core',
    },
  },
  MAX_ESSENCE_DROP: 100, // Max essence that can drop from a single block

  // Unity pool (level goal)
  UNITY_ESSENCE_GOAL: 200,
  UNITY_ESSENCE_INITIAL: 50,

  // Shop items
  ITEMS: {
    LADDER: {
      baseValue: 5,
      texture: 'ladder',
      name: 'Ladder',
      description: 'Allows climbing in tunnels',
      usable: true,
    },
  },

  // Race definitions
  RACES: {
    tribe: {
      name: 'Tribe of the Mask',
      id: 'tribe',
      description: 'Tribal warriors with stamina boost and tool making abilities',
      miningSpeedMultiplier: 1.0, // Base mining speed
      movementSpeedMultiplier: 1.0, // Base movement speed
      staminaLimit: 300,
      patienceLimit: 100,
      healthLimit: 100,
      essenceLimit: 50,
      attackPower: 10, // Balanced warrior damage
      attackInterval: 1500, // ms between attacks
      upkeepPerMinute: 0.5,
      upkeepDamagePerSecond: 5,
    },
    fungus: {
      name: 'Cult of the Spore',
      id: 'fungus',
      description: 'Mole-like creatures with fast digging and climbing abilities',
      miningSpeedMultiplier: 1.5, // 50% faster mining
      movementSpeedMultiplier: 1.0, // Normal movement speed
      staminaLimit: 200,
      patienceLimit: 75,
      healthLimit: 120,
      essenceLimit: 40,
      attackPower: 15, // Slower but hardy
      attackInterval: 2000, // ms between attacks
      upkeepPerMinute: 1,
      upkeepDamagePerSecond: 4,
    },
    petal: {
      name: 'Order of the Seed',
      id: 'petal',
      description: 'Plant-based beings with regeneration and vine creation',
      miningSpeedMultiplier: 1.0, // Base mining speed
      movementSpeedMultiplier: 0.85, // 15% slower movement (plant-based)
      staminaLimit: 160,
      patienceLimit: 150,
      healthLimit: 80,
      essenceLimit: 60,
      attackPower: 6, // Fast but light strikes
      attackInterval: 1000, // ms between attacks
      upkeepPerMinute: 0.25,
      upkeepDamagePerSecond: 3,
    },
  },

  // Character settings (base stats)
  CHAR_SPEED: 100,
  CHAR_JUMP_VELOCITY: -300,
  CHAR_SIZE: 32,
  MINING_RANGE: 40,
  MINING_TIME: 5000, // ms to mine one block (base time)
  MAX_HEALTH: 100,
  MAX_ITEMS: 4,

  // Physics
  GRAVITY: 600,

  // UI Colors
  UI_BACKGROUND: 0x3f4949,
  UI_TEXT_COLOR: '#ffffff',
};

export function getItemConfig(itemType: string): TradableConfig | null {
  return (
    CONFIG.ITEMS[itemType as keyof typeof CONFIG.ITEMS] ||
    CONFIG.RESOURCES[itemType as keyof typeof CONFIG.RESOURCES] ||
    null
  );
}

export function getBaseItemConfig(itemType: string): BaseItem | null {
  return (
    CONFIG.ITEMS[itemType as keyof typeof CONFIG.ITEMS] ||
    CONFIG.RESOURCES[itemType as keyof typeof CONFIG.RESOURCES] ||
    CONFIG.ESSENCE[itemType as keyof typeof CONFIG.ESSENCE] ||
    null
  );
}

// Export types for use in other files
export type {  RaceConfig,     };
