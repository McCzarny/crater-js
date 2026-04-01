import Phaser from 'phaser';
import { CONFIG } from './config';
import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import UIScene from './scenes/UIScene';

/**
 * Main game initialization
 */
const config: Phaser.Types.Core.GameConfig = {
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
(window as any).game = game;
