import Phaser from 'phaser';
import { CONFIG } from '../config';
import CharacterIcons from '../ui/CharacterIcons';
import EssenceUI from '../ui/EssenceUI';
import HUD from '../ui/HUD';
import TooltipManager from '../ui/TooltipManager';
import GameScene from './GameScene';
import type Character from '../entities/Character';

interface AbilityButtonElements {
  btn: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
}

/**
 * UI overlay scene - displays HUD, inventory, resources, etc.
 */
export default class UIScene extends Phaser.Scene {
  characterIcons!: CharacterIcons;
  essenceUI!: EssenceUI;
  hud!: HUD;
  tooltipManager!: TooltipManager;
  characterButtons!: Phaser.GameObjects.Sprite[];
  characterButtonBorders!: Phaser.GameObjects.Rectangle[];
  activeCharacterIndex!: number;
  abilityButtonElements!: AbilityButtonElements[];

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    console.log('UIScene: Initializing...');

    // Initialize tooltip manager
    this.tooltipManager = new TooltipManager(this, 300);

    // Compose modular UI components (mocks/dummies)
    this.characterIcons = new CharacterIcons(this);

    // Wait for GameScene to be ready, then update icons with actual characters
    this.events.once('updateCharacterIcons', () => {
      const gameScene = this.scene.get('GameScene') as GameScene;
      if (gameScene && gameScene.characters) {
        this.characterIcons.update(gameScene.characters, 40, 40, 60);
      }
    });

    this.essenceUI = new EssenceUI(this, { points: 0 });
    this.essenceUI.create(CONFIG.GAME_WIDTH - 90, 24);

    this.hud = new HUD(this);
    this.hud.create();
    this.hud.setTooltipManager(this.tooltipManager);

    // Listen for game events (legacy hooks)
    this.game.events.on('inventoryChanged', this.updateInventory, this);
    // Update HUD portrait when active character changes in GameScene
    this.game.events.on(
      'characterSwitched',
      (player: Character) => {
        if (this.hud && this.hud.updateCharacter) {
          this.hud.updateCharacter(player);
        }
        if (this.hud && this.hud.updateAbilities) {
          this.hud.updateAbilities(player);
        }
      },
      this,
    );

    // Trigger initial HUD update if GameScene already has a player and update character icons
    try {
      const gameScene = this.scene.get('GameScene') as GameScene;
      if (gameScene && gameScene.player && this.hud && this.hud.updateCharacter) {
        this.hud.updateCharacter(gameScene.player);
        if (this.hud.updateAbilities) {
          this.hud.updateAbilities(gameScene.player);
        }
        // Update character icons
        this.characterIcons.update(gameScene.characters, 40, 40, 60);
      }
    } catch {
      // ignore if GameScene not available yet
    }

    // Clean up components on scene shutdown
    this.events.on('shutdown', this.onShutdown, this);
  }

  update(): void {
    // Only update button visual states, not recreate them
    const gameScene = this.scene.get('GameScene') as GameScene;
    if (gameScene && gameScene.player) {
      const player = gameScene.player;
      if (this.hud && this.hud.update) {
        this.hud.update(player);
      }
    }

    // Update tooltip content if visible (keeps cooldown counter fresh)
    if (this.tooltipManager) {
      this.tooltipManager.update();
    }
  }

  onShutdown(): void {
    if (this.characterIcons && this.characterIcons.destroy) {
      this.characterIcons.destroy();
    }
    if (this.essenceUI && this.essenceUI.destroy) {
      this.essenceUI.destroy();
    }
    if (this.tooltipManager && this.tooltipManager.destroy) {
      this.tooltipManager.destroy();
    }
    if (this.hud && this.hud.destroy) {
      this.hud.destroy();
    }
  }

  updateInventory(inventory: (string | null)[]): void {
    if (this.hud && this.hud.updateInventory) {
      this.hud.updateInventory(inventory);
    } else {
      console.log('Inventory updated:', inventory);
    }
  }
}
