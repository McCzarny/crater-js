import Phaser from 'phaser';
import { CONFIG } from '../config.js';

/**
 * UI overlay scene - displays HUD, inventory, resources, etc.
 */
export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    console.log('UIScene: Initializing...');

    // Create semi-transparent background for UI
    this.add
      .rectangle(0, 0, CONFIG.GAME_WIDTH, 60, CONFIG.UI_BACKGROUND, 0.8)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Create text displays
    this.inventoryText = this.add
      .text(10, 10, 'Inventory: [Empty] [Empty]', {
        fontSize: '16px',
        color: CONFIG.UI_TEXT_COLOR,
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(101);

    // Race info display
    this.raceInfoText = this.add
      .text(10, 35, '', {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.instructionsText = this.add
      .text(CONFIG.GAME_WIDTH - 10, 10, 'E: Pickup | Q: Search | Space: Stop', {
        fontSize: '12px',
        color: CONFIG.UI_TEXT_COLOR,
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.instructionsText2 = this.add
      .text(CONFIG.GAME_WIDTH - 10, 25, 'Arrows: Move | Shift: Sprint', {
        fontSize: '12px',
        color: CONFIG.UI_TEXT_COLOR,
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    // Create Dig Menu button
    const digButtonX = CONFIG.GAME_WIDTH / 2 - 70;
    const buttonY = 20;

    this.digMenuButton = this.add
      .rectangle(digButtonX, buttonY, 120, 30, 0x00aa00, 0.8)
      .setScrollFactor(0)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    this.digMenuButtonText = this.add
      .text(digButtonX, buttonY, 'DIG MENU', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    // Create Stop button
    const stopButtonX = CONFIG.GAME_WIDTH / 2 + 70;

    this.stopButton = this.add
      .rectangle(stopButtonX, buttonY, 120, 30, 0xcc0000, 0.8)
      .setScrollFactor(0)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    this.stopButtonText = this.add
      .text(stopButtonX, buttonY, 'STOP', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    // Dig Menu button hover effects
    this.digMenuButton.on('pointerover', () => {
      this.digMenuButton.setFillStyle(0x00ff00, 1);
    });

    this.digMenuButton.on('pointerout', () => {
      this.digMenuButton.setFillStyle(0x00aa00, 0.8);
    });

    // Dig Menu button click - emit event to GameScene
    this.digMenuButton.on('pointerdown', () => {
      this.scene.get('GameScene').events.emit('showDigMenu');
    });

    // Stop button hover effects
    this.stopButton.on('pointerover', () => {
      this.stopButton.setFillStyle(0xff0000, 1);
    });

    this.stopButton.on('pointerout', () => {
      this.stopButton.setFillStyle(0xcc0000, 0.8);
    });

    // Stop button click - emit event to GameScene
    this.stopButton.on('pointerdown', () => {
      this.scene.get('GameScene').events.emit('stopCharacter');
    });

    // Create character selection buttons at the bottom of the screen
    this.createCharacterButtons();

    // Stamina display
    this.staminaText = this.add
      .text(CONFIG.GAME_WIDTH - 10, 50, 'Stamina: 100/100', {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    // Create ability buttons (initially empty, will be populated on character selection)
    this.abilityButtons = [];
    this.createAbilityButtons();

    // Listen for game events
    this.game.events.on('inventoryChanged', this.updateInventory, this);

    // Listen for ability state changes from GameScene
    this.game.events.on('abilityStateChanged', this.updateAbilityButtons, this);

    // Track active character
    this.activeCharacterIndex = 0;

    // Update initial race info
    this.updateRaceInfo('tribe');
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
    if (this.abilityButtonElements.length > 0) {
      this.updateAbilityButtonStates();
    }

    // Update stamina display
    const gameScene = this.scene.get('GameScene');
    if (gameScene && gameScene.player) {
      const st = Math.round(gameScene.player.stamina || 0);
      const max = Math.round(gameScene.player.maxStamina || 100);
      this.staminaText.setText(`Stamina: ${st}/${max}`);
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
    const slot1 = inventory[0] ? `[${inventory[0]}]` : '[Empty]';
    const slot2 = inventory[1] ? `[${inventory[1]}]` : '[Empty]';

    // Use rich text to color each slot differently
    this.inventoryText.setText(`Inventory: ${slot1} ${slot2}`);
  }
}
