/**
 * Game configuration constants with TypeScript types
 */

// Layer configuration
interface LayerConfig {
  start: number;
  end: number;
  color: number;
}

// Resource types
interface ResourceConfig {
  color: number;
  value: number;
  texture: string;
}

// Essence types
interface EssenceConfig {
  color: number;
  max_value: number;
  texture: string;
}

// Race configuration
interface RaceConfig {
  name: string;
  description: string;
  miningSpeedMultiplier: number;
  movementSpeedMultiplier: number;
  staminaLimit: number;
  patienceLimit: number;
  healthLimit: number;
  essenceLimit: number;
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
  WORLD_WIDTH: 200, // Width in blocks
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
    COAL: { color: 0x1a1a1a, value: 5, texture: 'coal' },
    DIAMOND: { color: 0x00ffff, value: 100, texture: 'diamond' },
    EMERALD: { color: 0x00ff00, value: 75, texture: 'emerald' },
    AMETHYST: { color: 0x0000ff, value: 90, texture: 'amethyst' },
  },
  ESSENCE: {
    ESSENCE_GRAIN: { color: 0xffff00, max_value: 10, texture: 'essence_grain' },
    ESSENCE_LUMP: { color: 0xffa500, max_value: 25, texture: 'essence_lump' },
    ESSENCE_CHUNK: { color: 0xff4500, max_value: 50, texture: 'essence_chunk' },
    ESSENCE_CORE: { color: 0xff0000, max_value: 9999, texture: 'essence_core' },
  },
  MAX_ESSENCE_DROP: 100, // Max essence that can drop from a single block
  // Race definitions
  RACES: {
    tribe: {
      name: 'Tribe of the Mask',
      description: 'Tribal warriors with stamina boost and tool making abilities',
      miningSpeedMultiplier: 1.0, // Base mining speed
      movementSpeedMultiplier: 1.0, // Base movement speed
      staminaLimit: 300,
      patienceLimit: 100,
      healthLimit: 100,
      essenceLimit: 50,
    },
    fungus: {
      name: 'Cult of the Spore',
      description: 'Mole-like creatures with fast digging and climbing abilities',
      miningSpeedMultiplier: 1.5, // 50% faster mining
      movementSpeedMultiplier: 1.0, // Normal movement speed
      staminaLimit: 200,
      patienceLimit: 75,
      healthLimit: 120,
      essenceLimit: 40,
    },
    petal: {
      name: 'Order of the Seed',
      description: 'Plant-based beings with regeneration and vine creation',
      miningSpeedMultiplier: 1.0, // Base mining speed
      movementSpeedMultiplier: 0.85, // 15% slower movement (plant-based)
      staminaLimit: 160,
      patienceLimit: 150,
      healthLimit: 80,
      essenceLimit: 60,
    },
  },

  // Character settings (base stats)
  CHAR_SPEED: 100,
  CHAR_JUMP_VELOCITY: -300,
  CHAR_SIZE: 28,
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

// Export types for use in other files
export type { GameConfig, RaceConfig, ResourceConfig, EssenceConfig, LayerConfig };
