import Phaser from 'phaser';
import { CONFIG } from '../config';
import TerrainSystem from '../systems/TerrainSystem';
import BaseSystem from '../systems/BaseSystem';
import CombatSystem from '../systems/CombatSystem';
import Character from '../entities/Character';

const WIND_TEXTURES = ['wind1', 'wind2', 'wind3', 'wind4'];
const WIND_SPRITE_WIDTH = 32;
const WIND_SPRITE_HEIGHT = 96;
const WIND_LAYER_Y = 0; // Y offset for wind layer (top of the world)
const WIND_LAYER_HEIGHT = 4 * WIND_SPRITE_HEIGHT; // Only top ~4 wind sprites high
const WIND_SPRITE_COUNT = 12; // Number of wind sprites

interface WindSprite extends Phaser.GameObjects.Image {
  windSpeed: number;
}

interface GameKeys {
  space: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
  pickup: Phaser.Input.Keyboard.Key;
  search: Phaser.Input.Keyboard.Key;
  ability: Phaser.Input.Keyboard.Key;
  [key: string]: Phaser.Input.Keyboard.Key;
}

/**
 * Main gameplay scene
 */
export default class GameScene extends Phaser.Scene {
  terrainSystem!: TerrainSystem;
  baseSystem!: BaseSystem;
  combatSystem!: CombatSystem;
  characters!: Character[];
  activeCharacterIndex!: number;
  player!: Character;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: GameKeys;
  windSprites!: WindSprite[];
  globalEssence: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Notify UIScene to update character icons after all characters are created
    this.scene.get('UIScene').events.emit('updateCharacterIcons');
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

    // Initialize combat system
    this.combatSystem = new CombatSystem(this);

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
        .setScale((1.0 + Math.random() * 0.3) * direction, 1.0 + Math.random() * 0.1) as WindSprite;
      sprite.windSpeed = speed * direction;
      this.windSprites.push(sprite);
    }

    // Create 6 characters: 2 for each race, at/near their bases
    const races = ['tribe', 'fungus', 'petal'];
    this.characters = [];
    for (const race of races) {
      const base = this.baseSystem.getBaseCenter(race);
      // First character at base center, slightly above
      this.addCharacter(race, base.gridX, base.gridY - 1);
      // Second character offset by +2 x
      this.addCharacter(race, base.gridX + 1, base.gridY - 1);
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
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      pickup: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      search: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      ability: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    // Listen for stop button click from UIScene
    this.events.on('stopCharacter', () => {
      this.player.stopAllActions();
    });

    // Listen for direction selection
    this.events.on('directionSelected', (direction: { dx: number; dy: number }) => {
      this.player.startAutoDig(direction);
    });

    // ESC key to cancel all actions
    this.input.keyboard!.on('keydown-ESC', () => {
      this.player.stopAllActions();
    });

    // Listen for character switch events from UIScene
    this.events.on('switchCharacter', (index: number) => {
      this.switchCharacter(index);
    });

    // Listen for ability toggle events from UIScene
    this.events.on('toggleAbility', (abilityIndex: number) => {
      const toggled = this.player.abilities.toggleAbility(abilityIndex);
      if (!toggled) {
        console.log('Cannot activate ability right now');
      }
      // Notify UI to update button states
      this.game.events.emit('abilityStateChanged');
    });

    // Listen for drop item events from UIScene
    this.events.on('dropItem', (slotIndex: number) => {
      if (this.player && this.player.inventory) {
        this.player.inventory.dropItem(slotIndex);
      }
    });

    // Use an inventory item (e.g. place a ladder) from UIScene
    this.events.on('useItem', (slotIndex: number) => {
      if (this.player) {
        this.player.inventory.useItem(slotIndex);
      }
    });

    // Transfer all essence from active character to global pool
    this.events.on('transferEssence', () => {
      if (this.player && this.player.essence > 0) {
        this.globalEssence += this.player.essence;
        this.player.essence = 0;
        this.game.events.emit('essenceTransferred', this.globalEssence);
      }
    });

    // Open trade window for current player
    this.events.on('openTrade', () => {
      this.game.events.emit('openTrade', this.player);
    });

    // Sell an inventory item for essence
    this.events.on('sellItem', (slotIndex: number) => {
      if (!this.player || !this.player.inventory) {
        return;
      }
      const inventory = this.player.inventory.inventory;
      const itemType = inventory[slotIndex];
      if (!itemType) {
        return;
      }
      const resourceConfig = CONFIG.RESOURCES[itemType as keyof typeof CONFIG.RESOURCES];
      if (!resourceConfig) {
        return;
      }
      inventory[slotIndex] = null;
      const gained = Math.min(
        resourceConfig.baseValue,
        this.player.maxEssence - this.player.essence,
      );
      this.player.essence += gained;
      this.game.events.emit('inventoryChanged', [...inventory]);
      this.game.events.emit('essenceChanged', this.player.essence, this.player.maxEssence);
    });

    // Buy an item from the trader
    this.events.on('buyItem', (itemKey: string) => {
      if (!this.player || !this.player.inventory) {
        return;
      }
      const itemConfig = CONFIG.ITEMS[itemKey as keyof typeof CONFIG.ITEMS];
      if (!itemConfig) {
        return;
      }
      if (this.player.essence < itemConfig.baseValue) {
        return;
      }
      const inventory = this.player.inventory.inventory;
      const emptySlot = inventory.findIndex(s => s === null);
      if (emptySlot === -1) {
        return;
      }
      this.player.essence -= itemConfig.baseValue;
      inventory[emptySlot] = itemKey;
      this.game.events.emit('inventoryChanged', [...inventory]);
      this.game.events.emit('essenceChanged', this.player.essence, this.player.maxEssence);
    });

    console.log('GameScene: Ready!');
  }

  /**
   * Switch to a different character
   */
  switchCharacter(index: number): void {
    if (index < 0 || index >= this.characters.length) {
      return;
    }

    // Switch to new character
    this.activeCharacterIndex = index;
    this.player = this.characters[index];

    // Update camera to follow new character
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    console.log('Switched to character:', this.player.race);
    // Notify UI that active character changed
    if (this.game && this.game.events && this.player) {
      this.game.events.emit('characterSwitched', this.player);
    }
  }

  update(time: number, delta: number): void {
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

    // Update Essence Spider AI
    if (this.terrainSystem) {
      this.terrainSystem.updateSpiders(this.characters, time, delta);
    }

    // Run combat: characters vs characters and mobs
    if (this.combatSystem && this.terrainSystem) {
      this.combatSystem.update(this.characters, this.terrainSystem.spiders, delta);
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

  /**
   * Add a new character of a given race at (x, y)
   * @param race - The race of the character
   * @param x - Grid x position
   * @param y - Grid y position
   * @returns The created character
   */
  addCharacter(race: string, x: number, y: number): Character {
    const character = new Character(this, x, y, race, this.characters.length);
    this.characters.push(character);
    return character;
  }
}
