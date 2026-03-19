/**
 * Game configuration constants
 */
export const CONFIG = {
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
    STONE: { color: 0x999999, value: 1 },
    COAL: { color: 0x1a1a1a, value: 5 },
    IRON: { color: 0xc0c0c0, value: 10 },
    GOLD: { color: 0xffd700, value: 50 },
    DIAMOND: { color: 0x00ffff, value: 100 },
  },

  // Race definitions
  RACES: {
    tribe: {
      name: 'Tribe of the Mask',
      description: 'Tribal warriors with stamina boost and tool making abilities',
      miningSpeedMultiplier: 1.0, // Base mining speed
      movementSpeedMultiplier: 1.0, // Base movement speed
    },
    fungus: {
      name: 'Cult of the Spore',
      description: 'Mole-like creatures with fast digging and climbing abilities',
      miningSpeedMultiplier: 1.5, // 50% faster mining
      movementSpeedMultiplier: 1.0, // Normal movement speed
    },
    petal: {
      name: 'Order of the Seed',
      description: 'Plant-based beings with regeneration and vine creation',
      miningSpeedMultiplier: 1.0, // Base mining speed
      movementSpeedMultiplier: 0.85, // 15% slower movement (plant-based)
    },
  },

  // Character settings (base stats)
  CHAR_SPEED: 100,
  CHAR_JUMP_VELOCITY: -300,
  CHAR_SIZE: 28,
  MINING_RANGE: 40,
  MINING_TIME: 5000, // ms to mine one block (base time)

  // Physics
  GRAVITY: 600,

  // UI Colors
  UI_BACKGROUND: 0x222222,
  UI_TEXT_COLOR: '#ffffff',
};
