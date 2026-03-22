import Phaser from 'phaser';

/**
 * Boot scene - loads initial assets and sets up the game
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load race icons
    this.load.image('tribe', 'resources/icons/races/tribe.png');
    this.load.image('fungus', 'resources/icons/races/fungus.png');
    this.load.image('petal', 'resources/icons/races/petal.png');
    // Bases
    this.load.image('vine', 'resources/tile-decals/vine.png');
    this.load.image('tribe-base', 'resources/structures/tribe_base.png');
    this.load.image('fungus-base', 'resources/structures/fungus_base.png');
    this.load.image('petal-base', 'resources/structures/petal_base.png');
    // Environment tiles
    this.load.image('boulder', 'resources/tiles/boulder.png');

    // Wind effects
    this.load.image('wind1', 'resources/tile-decals/wind_1.png');
    this.load.image('wind2', 'resources/tile-decals/wind_2.png');
    this.load.image('wind3', 'resources/tile-decals/wind_3.png');
    this.load.image('wind4', 'resources/tile-decals/wind_4.png');

    // Resource icons
    this.load.image('coal', 'resources/tile-decals/coal.png');
    this.load.image('gold', 'resources/tile-decals/gold.png');
    this.load.image('diamond', 'resources/tile-decals/diamond.png');
    this.load.image('emerald', 'resources/tile-decals/emerald.png');
    this.load.image('sapphire', 'resources/tile-decals/sapphire.png');

    // Tile textures (add your own as needed)
    this.load.image('dirt', 'resources/tiles/dirt.png');
    this.load.image('mined_dirt', 'resources/tiles/mined_dirt.png');
    this.load.image('stone', 'resources/tiles/stone.png');
    this.load.image('mined_stone', 'resources/tiles/mined_stone.png');
    this.load.image('iron_stone', 'resources/tiles/iron_stone.png');
    this.load.image('mined_iron_stone', 'resources/tiles/mined_iron_stone.png');
    this.load.image('deep_stone', 'resources/tiles/deep_stone.png');
    this.load.image('mined_deep_stone', 'resources/tiles/mined_deep_stone.png');
    this.load.image('rare_ore', 'resources/tiles/rare_ore.png');
    this.load.image('mined_rare_ore', 'resources/tiles/mined_rare_ore.png');

    // NOTE: If a texture file does not exist, the tile will fall back to color rendering.

    console.log('BootScene: Loading race icons and tile textures...');
  }

  create() {
    console.log('BootScene: Starting game...');
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }
}
