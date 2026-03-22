import Phaser from 'phaser';
import { CONFIG } from './config.js';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';

/**
 * Main game initialization
 */
const config = {
  type: Phaser.AUTO,
  width: CONFIG.GAME_WIDTH / CONFIG.PIXEL_SCALE,
  height: CONFIG.GAME_HEIGHT / CONFIG.PIXEL_SCALE,
  parent: 'game-container',
  backgroundColor: '#b1b1b1',
  scene: [BootScene, GameScene, UIScene],
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: CONFIG.PIXEL_SCALE,
  },
};

const game = new Phaser.Game(config);

// Make it accessible for debugging
window.game = game;
