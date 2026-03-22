import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import TerrainSystem from '../systems/TerrainSystem.js';
import BaseSystem from '../systems/BaseSystem.js';
import Character from '../entities/Character.js';
import DirectionMenu from '../ui/DirectionMenu.js';

const WIND_TEXTURES = ['wind1', 'wind2', 'wind3', 'wind4'];
const WIND_SPRITE_WIDTH = 32;
const WIND_SPRITE_HEIGHT = 96;
const WIND_LAYER_Y = 0; // Y offset for wind layer (top of the world)
const WIND_LAYER_HEIGHT = 4 * WIND_SPRITE_HEIGHT; // Only top ~4 wind sprites high
const WIND_SPRITE_COUNT = 12; // Number of wind sprites

/**
 * Main gameplay scene
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    console.log('GameScene: Initializing...');

    // Initialize systems
    this.terrainSystem = new TerrainSystem(this);

    // Create the world
    this.terrainSystem.generateWorld();

    // Initialize base system (places bases on the surface)
    this.baseSystem = new BaseSystem(this, this.terrainSystem);

    // Make systems available to other objects
    this.registry.set('terrainSystem', this.terrainSystem);
    this.registry.set('baseSystem', this.baseSystem);

    // --- WIND EFFECT SYSTEM ---
    this.windSprites = [];
    const worldPixelWidth = CONFIG.WORLD_WIDTH * CONFIG.BLOCK_SIZE;
    const windTop = WIND_LAYER_Y;
    const windBottom = WIND_LAYER_Y + WIND_LAYER_HEIGHT;
    for (let i = 0; i < WIND_SPRITE_COUNT; i++) {
      // Randomize initial position and texture
      const x = Math.random() * worldPixelWidth;
      const y = windTop + Math.random() * (windBottom - windTop - WIND_SPRITE_HEIGHT);
      const texture = Phaser.Utils.Array.GetRandom(WIND_TEXTURES);
      const speed = 500 + Math.random() * 200; // px/sec, strong wind
      const direction = Math.random() < 0.5 ? 1 : -1; // left or right
      const sprite = this.add
        .image(x, y, texture)
        .setAlpha(0.7 + Math.random() * 0.3)
        .setDepth(1000)
        .setScale((1.0 + Math.random() * 0.3) * direction, 1.0 + Math.random() * 0.1);
      sprite.windSpeed = speed * direction;
      this.windSprites.push(sprite);
    }

    // Create 3 characters, one for each race
    // Spawn them at their respective bases
    const races = ['tribe', 'fungus', 'petal'];
    this.characters = [];

    for (const race of races) {
      const base = this.baseSystem.getBaseCenter(race);
      if (base) {
        // Spawn character at the base center, slightly above
        this.characters.push(new Character(this, base.gridX, base.gridY - 1, race));
        console.log(`Spawned ${race} character at base (${base.gridX}, ${base.gridY - 1})`);
      } else {
        // Fallback to center if base not found
        console.warn(`Base not found for ${race}, using fallback position`);
        const spawnX = Math.floor(CONFIG.WORLD_WIDTH / 2);
        const spawnY = CONFIG.SURFACE_HEIGHT - 2;
        this.characters.push(new Character(this, spawnX, spawnY, race));
      }
    }

    // Set first character as active
    this.activeCharacterIndex = 0;
    this.player = this.characters[this.activeCharacterIndex];

    // Set up camera
    this.cameras.main.setBounds(
      0,
      0,
      CONFIG.WORLD_WIDTH * CONFIG.BLOCK_SIZE,
      CONFIG.WORLD_HEIGHT * CONFIG.BLOCK_SIZE,
    );
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // Set up input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = {
      space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      pickup: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      search: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      ability: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    // Create direction menu
    this.directionMenu = new DirectionMenu(this);

    // Listen for dig menu button click from UIScene
    this.events.on('showDigMenu', () => {
      if (!this.directionMenu.isVisible) {
        this.directionMenu.show();
      } else {
        this.directionMenu.hide();
      }
    });

    // Listen for stop button click from UIScene
    this.events.on('stopCharacter', () => {
      this.player.stopAllActions();
      this.directionMenu.hide();
    });

    // Listen for direction selection
    this.events.on('directionSelected', direction => {
      this.player.startAutoDig(direction);
    });

    // ESC key to cancel all actions
    this.input.keyboard.on('keydown-ESC', () => {
      this.player.stopAllActions();
      this.directionMenu.hide();
    });

    // Listen for character switch events from UIScene
    this.events.on('switchCharacter', index => {
      this.switchCharacter(index);
    });

    // Listen for ability toggle events from UIScene
    this.events.on('toggleAbility', abilityIndex => {
      const toggled = this.player.abilities.toggleAbility(abilityIndex);
      if (!toggled) {
        console.log('Cannot activate ability right now');
      }
      // Notify UI to update button states
      this.game.events.emit('abilityStateChanged');
    });

    console.log('GameScene: Ready!');
  }

  /**
   * Switch to a different character
   */
  switchCharacter(index) {
    if (index < 0 || index >= this.characters.length) {
      return;
    }

    // Hide direction menu when switching
    this.directionMenu.hide();

    // Switch to new character
    this.activeCharacterIndex = index;
    this.player = this.characters[index];

    // Update camera to follow new character
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    console.log('Switched to character:', this.player.race);
  }

  update(time, delta) {
    // Update all characters for physics (falling, movement)
    for (let i = 0; i < this.characters.length; i++) {
      const character = this.characters[i];
      // Only pass input to the active character
      if (i === this.activeCharacterIndex) {
        character.update(this.cursors, this.keys, time, delta);
      } else {
        // For inactive characters, only update physics (no input)
        character.update(null, {}, time, delta);
      }
    }

    // Update terrain system (for item gravity)
    if (this.terrainSystem) {
      this.terrainSystem.updateItems(time);
    }

    // --- WIND EFFECT UPDATE ---
    if (this.windSprites) {
      const worldPixelWidth = CONFIG.WORLD_WIDTH * CONFIG.BLOCK_SIZE;
      for (const sprite of this.windSprites) {
        sprite.x += sprite.windSpeed * (delta / 1000);
        // Wrap horizontally
        if (sprite.windSpeed > 0 && sprite.x > worldPixelWidth + WIND_SPRITE_WIDTH / 2) {
          sprite.x = -WIND_SPRITE_WIDTH / 2;
        } else if (sprite.windSpeed < 0 && sprite.x < -WIND_SPRITE_WIDTH / 2) {
          sprite.x = worldPixelWidth + WIND_SPRITE_WIDTH / 2;
        }
      }
    }
  }
}
