import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import CharacterIcons from '../ui/CharacterIcons.js';
import EssenceUI from '../ui/EssenceUI.js';
import HUD from '../ui/HUD.js';

/**
 * UI overlay scene - displays HUD, inventory, resources, etc.
 */
export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    console.log('UIScene: Initializing...');

    // Compose modular UI components (mocks/dummies)
    this.characterIcons = new CharacterIcons(this, { races: ['tribe', 'fungus', 'petal'] });
    this.characterIcons.create(40, 40, 60);

    this.essenceUI = new EssenceUI(this, { points: 0 });
    this.essenceUI.create(CONFIG.GAME_WIDTH - 90, 24);

    this.hud = new HUD(this);
    this.hud.create();

    // Initialize ability buttons container (may be populated later)
    this.createAbilityButtons();
    // Listen for game events (legacy hooks)
    this.game.events.on('inventoryChanged', this.updateInventory, this);
    this.game.events.on('abilityStateChanged', this.updateAbilityButtons, this);
    // Update HUD portrait when active character changes in GameScene
    this.game.events.on(
      'characterSwitched',
      player => {
        if (this.hud && this.hud.updateCharacter) {
          this.hud.updateCharacter(player);
        }
        if (this.hud && this.hud.updateAbilities) {
          this.hud.updateAbilities(player);
        }
      },
      this,
    );

    // Trigger initial HUD update if GameScene already has a player
    try {
      const gameScene = this.scene.get('GameScene');
      if (gameScene && gameScene.player && this.hud && this.hud.updateCharacter) {
        this.hud.updateCharacter(gameScene.player);
        if (this.hud.updateAbilities) {
          this.hud.updateAbilities(gameScene.player);
        }
      }
    } catch (e) {
      // ignore if GameScene not available yet
    }

    // Clean up components on scene shutdown
    this.events.on('shutdown', this.onShutdown, this);
  }

  onShutdown() {
    if (this.characterIcons && this.characterIcons.destroy) {
      this.characterIcons.destroy();
    }
    if (this.essenceUI && this.essenceUI.destroy) {
      this.essenceUI.destroy();
    }
    if (this.hud && this.hud.destroy) {
      this.hud.destroy();
    }
  }
  /**
   * Create character selection buttons
   */
  createCharacterButtons() {
    const buttonSize = 50;
    const buttonSpacing = 60;
    const startX = CONFIG.GAME_WIDTH / 2 - buttonSpacing;
    const startY = CONFIG.GAME_HEIGHT - 70;

    const races = ['tribe', 'fungus', 'petal'];
    this.characterButtons = [];
    this.characterButtonBorders = [];

    for (let i = 0; i < races.length; i++) {
      const x = startX + i * buttonSpacing;
      const y = startY;

      // Background for button
      this.add
        .rectangle(x, y, buttonSize + 4, buttonSize + 4, 0x444444, 1)
        .setScrollFactor(0)
        .setDepth(100);

      // Border to highlight selected character
      const border = this.add
        .rectangle(x, y, buttonSize + 8, buttonSize + 8, 0xffff00, 1)
        .setScrollFactor(0)
        .setDepth(99)
        .setVisible(i === 0); // Only first one visible initially

      this.characterButtonBorders.push(border);

      // Character icon
      const icon = this.add
        .sprite(x, y, races[i])
        .setDisplaySize(buttonSize, buttonSize)
        .setScrollFactor(0)
        .setDepth(101)
        .setInteractive({ useHandCursor: true });

      // Click handler
      icon.on('pointerdown', () => {
        this.selectCharacter(i);
      });

      // Hover effects
      icon.on('pointerover', () => {
        icon.setScale(1.1);
      });

      icon.on('pointerout', () => {
        icon.setScale(1);
      });

      this.characterButtons.push(icon);
    }
  }

  /**
   * Select a character
   */
  selectCharacter(index) {
    // Update borders
    for (let i = 0; i < this.characterButtonBorders.length; i++) {
      this.characterButtonBorders[i].setVisible(i === index);
    }

    // Update active character index
    this.activeCharacterIndex = index;

    // Update race info
    const races = ['tribe', 'fungus', 'petal'];
    this.updateRaceInfo(races[index]);

    // Emit event to GameScene
    this.scene.get('GameScene').events.emit('switchCharacter', index);

    // Update ability buttons for new character
    this.updateAbilityButtonsForCharacter();
  }

  /**
   * Update scene (called each frame)
   */
  update() {
    // Only update button visual states, not recreate them
    // (buttons are recreated when character switches)
    if (this.abilityButtonElements && this.abilityButtonElements.length > 0) {
      this.updateAbilityButtonStates();
    }

    if (this.hud && this.hud.updateAbilityIndicators) {
      try {
        const gameScene = this.scene.get('GameScene');
        if (gameScene && gameScene.player) {
          this.hud.updateAbilityIndicators(gameScene.player);
          if (this.hud.updateBars) {
            this.hud.updateBars(gameScene.player);
          }
        }
      } catch (e) {
        // GameScene may not be available yet
      }
    }
  }

  /**
   * Update race information display
   */
  updateRaceInfo(race) {
    const raceConfig = CONFIG.RACES[race];
    if (!raceConfig) {
      return;
    }

    const miningSpeed = (raceConfig.miningSpeedMultiplier * 100).toFixed(0);
    const moveSpeed = (raceConfig.movementSpeedMultiplier * 100).toFixed(0);

    this.raceInfoText.setText(
      `${raceConfig.name} | Mining: ${miningSpeed}% | Movement: ${moveSpeed}%`,
    );

    // Update ability buttons for this character
    this.updateAbilityButtonsForCharacter();
  }

  /**
   * Create ability buttons container
   */
  createAbilityButtons() {
    // Ability buttons will be created dynamically based on active character
    this.abilityButtonElements = [];
  }

  /**
   * Update ability buttons for current character
   */
  updateAbilityButtonsForCharacter() {
    // Clear existing ability buttons
    this.abilityButtonElements.forEach(elements => {
      elements.btn.destroy();
      elements.text.destroy();
      elements.hint.destroy();
    });
    this.abilityButtonElements = [];

    // Get active character from GameScene
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.player) {
      return;
    }

    const character = gameScene.player;
    const abilities = character.abilities.getAbilities();

    // If no abilities, don't create buttons
    if (abilities.length === 0) {
      return;
    }

    // Create button for each ability
    const buttonWidth = 100;
    const buttonHeight = 30;
    const buttonSpacing = 10;
    const startY = CONFIG.GAME_HEIGHT - 120; // Above character selection
    const totalWidth = abilities.length * buttonWidth + (abilities.length - 1) * buttonSpacing;
    const startX = (CONFIG.GAME_WIDTH - totalWidth) / 2;

    abilities.forEach((ability, index) => {
      const x = startX + index * (buttonWidth + buttonSpacing) + buttonWidth / 2;
      const y = startY;

      // Button background
      const canActivate = ability.canActivate();
      const isActive = ability.isActive();
      const canInteract = canActivate || isActive; // Can click if active OR can be activated
      const bgColor = isActive ? 0x00aaff : canActivate ? 0x0088cc : 0x666666;

      const btn = this.add
        .rectangle(x, y, buttonWidth, buttonHeight, bgColor, 0.8)
        .setScrollFactor(0)
        .setDepth(101)
        .setInteractive({ useHandCursor: canInteract });

      // Button text
      const text = this.add
        .text(x, y, ability.name().toUpperCase(), {
          fontSize: '12px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(102);

      // Keyboard hint
      const hint = this.add
        .text(x, y + 20, '(R)', {
          fontSize: '10px',
          color: '#aaaaaa',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(102);

      // Store ability index and reference to ability for updates
      btn.setData('abilityIndex', index);

      // Always add hover and click handlers
      btn.on('pointerover', () => {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene || !gameScene.player) {
          return;
        }
        const currentAbility = gameScene.player.abilities.getAbility(index);
        if (!currentAbility || !currentAbility.isActive()) {
          btn.setFillStyle(0x00aaff, 1);
        }
      });

      btn.on('pointerout', () => {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene || !gameScene.player) {
          return;
        }
        const currentAbility = gameScene.player.abilities.getAbility(index);
        const currentCanActivate = currentAbility ? currentAbility.canActivate() : false;
        const currentIsActive = currentAbility ? currentAbility.isActive() : false;

        if (currentIsActive) {
          btn.setFillStyle(0x00aaff, 0.8);
        } else if (currentCanActivate) {
          btn.setFillStyle(0x0088cc, 0.8);
        } else {
          btn.setFillStyle(0x666666, 0.8);
        }
      });

      // Click handler - always attached, checks if can interact at click time
      btn.on('pointerdown', () => {
        const abilityIndex = btn.getData('abilityIndex');
        this.scene.get('GameScene').events.emit('toggleAbility', abilityIndex);
      });

      this.abilityButtonElements.push({ btn, text, hint });
    });
    // Update HUD ability icons for this character (if HUD present)
    if (this.hud && this.hud.updateAbilities) {
      this.hud.updateAbilities(character);
    }
  }

  /**
   * Update ability buttons state (called when ability state changes)
   */
  updateAbilityButtons() {
    // Just refresh all buttons
    this.updateAbilityButtonsForCharacter();
  }

  /**
   * Update ability button visual states without recreating them
   * Called every frame for efficiency
   */
  updateAbilityButtonStates() {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.player) {
      return;
    }

    const character = gameScene.player;
    const abilities = character.abilities.getAbilities();

    this.abilityButtonElements.forEach((elements, index) => {
      if (index >= abilities.length) {
        return;
      }

      const ability = abilities[index];
      const canActivate = ability.canActivate();
      const isActive = ability.isActive();
      const canInteract = canActivate || isActive;

      // Update button color
      const bgColor = isActive ? 0x00aaff : canActivate ? 0x0088cc : 0x666666;
      elements.btn.setFillStyle(bgColor, 0.8);

      // Update interactivity
      if (canInteract) {
        elements.btn.setInteractive({ useHandCursor: true });
      } else {
        elements.btn.disableInteractive();
      }
    });
  }

  updateInventory(inventory) {
    if (this.hud && this.hud.updateInventory) {
      this.hud.updateInventory(inventory);
    } else {
      console.log('Inventory updated:', inventory);
    }
  }
}
