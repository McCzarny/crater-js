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
    this.load.image('vine', 'resources/tile-decals/vine.png');
    this.load.image('tribe-base', 'resources/structures/tribe_base.png');
    this.load.image('fungus-base', 'resources/structures/fungus_base.png');
    this.load.image('petal-base', 'resources/structures/petal_base.png');

    console.log('BootScene: Loading race icons...');
  }

  create() {
    console.log('BootScene: Starting game...');
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }
}
