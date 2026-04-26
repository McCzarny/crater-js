import Phaser from 'phaser';
import { CONFIG, type RaceConfig } from '../config';
import CharacterMovement from '../systems/CharacterMovement';
import CharacterMining from '../systems/CharacterMining';
import CharacterInventory from '../systems/CharacterInventory';
import CharacterAbilities from '../systems/CharacterAbilities';
import type TerrainSystem from '../systems/TerrainSystem';
import { ICharacter } from '../types/game-types';

/**
 * Character class - represents a playable character
 * Now uses composition pattern with separate systems for movement, mining, and inventory
 */
export default class Character implements ICharacter {
  isDead: boolean;
  scene: Phaser.Scene;
  race: string;
  raceConfig: RaceConfig;
  gridX: number;
  gridY: number;
  terrainSystem: TerrainSystem;
  sprite: Phaser.GameObjects.Sprite;

  // Movement settings
  baseSpeed: number;
  moveSpeed: number;
  sprintMultiplier: number;

  // Mining settings
  baseMiningTime: number;
  digInterval: number;
  fastDigInterval: number;

  // Subsystems
  movement: CharacterMovement;
  mining: CharacterMining;
  inventory: CharacterInventory;
  abilities: CharacterAbilities;

  // Stamina settings
  maxStamina: number;
  stamina: number;
  staminaDrainPerSecond: number;
  staminaRegenPerSecond: number;

  // Health settings
  maxHealth: number;
  health: number;

  // Combat settings
  attackPower: number;
  attackInterval: number;
  attackCooldown: number;

  // Patience settings
  patience: number;
  maxPatience: number;

  // Essence settings
  essence: number;
  maxEssence: number;

  constructor(scene: Phaser.Scene, x: number, y: number, race: string, idx: number) {
    this.isDead = false;
    this.scene = scene;
    this.race = race;

    // Get race stats
    const raceConfig = CONFIG.RACES[race as keyof typeof CONFIG.RACES] || CONFIG.RACES.tribe;
    this.raceConfig = raceConfig;

    // Grid position (in tiles)
    this.gridX = x;
    this.gridY = y;

    // Get terrain system reference
    this.terrainSystem = scene.registry.get('terrainSystem') as TerrainSystem;

    // Create sprite
    this.sprite = scene.add.sprite(
      this.gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      this.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      `${raceConfig.id}_character_sheet`,
    );
    this.sprite.setDisplaySize(CONFIG.CHAR_SIZE, CONFIG.CHAR_SIZE);
    this.sprite.setDepth(1000);
    this.sprite.play({ key: `${raceConfig.id}_idle`, repeat: -1, yoyo: true });

    // Make the sprite clickable to allow selecting the character from the world
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerover', () => this.sprite.setScale(1.05));
    this.sprite.on('pointerout', () => this.sprite.setScale(1));
    this.sprite.on('pointerdown', () => {
      if (this.isDead) {
        return;
      }
      // Emit a switchCharacter event on the scene; GameScene listens for this
      // and will switch active character based on the index in its array.
      this.scene.events.emit('switchCharacter', idx);
    });

    // Movement settings - apply race multiplier
    this.baseSpeed = CONFIG.CHAR_SPEED;
    this.moveSpeed = this.baseSpeed * raceConfig.movementSpeedMultiplier;
    this.sprintMultiplier = 2;

    // Mining settings - apply race multiplier
    this.baseMiningTime = CONFIG.MINING_TIME;
    this.digInterval = this.baseMiningTime / raceConfig.miningSpeedMultiplier;
    this.fastDigInterval = 500 / raceConfig.miningSpeedMultiplier;

    // Initialize subsystems
    this.movement = new CharacterMovement(this);
    this.mining = new CharacterMining(this);
    this.inventory = new CharacterInventory(this);
    this.abilities = new CharacterAbilities(this);

    // Stamina settings
    this.maxStamina = this.raceConfig.staminaLimit;
    this.stamina = this.maxStamina;
    this.staminaDrainPerSecond = 1;
    this.staminaRegenPerSecond = 10;

    // Health settings
    this.maxHealth = this.raceConfig.healthLimit;
    this.health = this.maxHealth;

    // Combat settings
    this.attackPower = raceConfig.attackPower;
    this.attackInterval = raceConfig.attackInterval;
    this.attackCooldown = 0; // Ready to attack immediately on first contact

    // Patience settings
    this.maxPatience = this.raceConfig.patienceLimit;
    this.patience = this.maxPatience;

    // Essence settings
    this.maxEssence = this.raceConfig.essenceLimit;
    this.essence = 0;
  }

  /**
   * Stop all active actions
   */
  stopAllActions(): void {
    this.mining.stopAutoDig();
    this.inventory.stopSearch();
    this.mining.stopMining();
    this.abilities.deactivateAll();
    this.sprite.clearTint();
    this.movement.stopMovement();
  }

  /**
   * Update character state
   */
  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | null,
    keys: Record<string, Phaser.Input.Keyboard.Key> | Record<string, never>,
    time: number,
    delta: number,
  ): void {
    if (this.isDead) {return;}

    // Update abilities
    this.abilities.update(time, delta);

    // Update visual feedback for abilities
    if (this.abilities.isClimbing) {
      this.sprite.setTint(0x00aaff); // Blue tint for climbing
    } else if (this.abilities.isPlantingSeeds) {
      this.sprite.setTint(0x00ff00); // Green tint for seed planting
    }

    // Derive animation from last frame's settled movement state, before any
    // new moves are queued.
    this.movement.updateAnimation();

    // Handle smooth movement to target position
    this.movement.updateSmoothMove(delta);

    // Update stamina: drain when digging (manual or auto), otherwise regenerate
    const deltaSecEarly = delta / 1000;
    if (this.mining.isMining || this.mining.isAutoDigging) {
      this.stamina -= this.staminaDrainPerSecond * deltaSecEarly;
      if (this.stamina <= 0) {
        this.stamina = 0;
        // Stop digging and idle
        this.stopAllActions();
        return;
      }
    } else if (!this.abilities.anyAbilityActive()) {
      this.stamina += this.staminaRegenPerSecond * deltaSecEarly;
      if (this.stamina > this.maxStamina) {
        this.stamina = this.maxStamina;
      }
    }

    // Space bar to stop all actions
    if (keys.space && keys.space.isDown) {
      this.stopAllActions();
    }

    // Handle falling before any mode-specific logic - physics override everything
    if (this.movement.isFalling) {
      this.movement.updateFalling(delta);
      return;
    }

    // Auto-digging mode takes priority for input
    if (this.mining.isAutoDigging) {
      // Check for direction key presses to change mining direction
      if (cursors && this.movement.canMove()) {
        if (cursors.left.isDown) {
          this.mining.setAutoDigDirection({ dx: -1, dy: 0 });
        } else if (cursors.right.isDown) {
          this.mining.setAutoDigDirection({ dx: 1, dy: 0 });
        } else if (cursors.down.isDown) {
          this.mining.setAutoDigDirection({ dx: 0, dy: 1 });
        }
        // Note: up arrow is ignored - cannot dig up
      }

      this.updateAutoDig(time, keys);
      return;
    }

    // Stop active actions when trying to move manually (except climbing)
    if (
      cursors &&
      (cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown)
    ) {
      // TODO: Stop all abilities except climbing
      // Stop seed planting on any movement
      if (this.abilities.isPlantingSeeds) {
        this.abilities.deactivateAll();
      }

      // Don't stop climbing when moving - it's intended to be used during movement
      this.mining.stopAutoDig();
      this.inventory.stopSearch();
      this.mining.stopMining();
      if (!this.abilities.isClimbing && !this.abilities.isPlantingSeeds) {
        this.sprite.clearTint();
      }
    }

    // Search mode takes highest priority
    if (this.inventory.isSearching) {
      this.updateSearch(time);
      return;
    }

    // If manually mining, continue mining progress
    if (this.mining.isMining) {
      this.mining.continueMining();
      return;
    }

    // Check if we should fall (only when not moving and not prevented by abilities)
    if (
      !this.movement.isMoving &&
      !this.abilities.shouldPreventFalling() &&
      this.movement.shouldFall()
    ) {
      this.movement.startFalling();
      return;
    }

    // Only process input if this character is controllable
    if (!cursors || !keys) {
      return;
    }

    // Ability toggle with 'R' key (first ability)
    if (keys.ability && Phaser.Input.Keyboard.JustDown(keys.ability)) {
      const toggled = this.abilities.toggleAbility(0);
      if (!toggled) {
        console.log('Cannot activate ability right now');
      }
    }

    // Pick up action with 'E' key
    if (keys.pickup && Phaser.Input.Keyboard.JustDown(keys.pickup)) {
      this.inventory.tryPickup();
    }

    // Search action with 'Q' key
    if (keys.search && Phaser.Input.Keyboard.JustDown(keys.search)) {
      if (this.inventory.isSearching) {
        this.inventory.stopSearch();
        this.sprite.clearTint();
      } else {
        this.stopAllActions();
        this.inventory.startSearch();
      }
    }

    this.mining.stopMining();
    if (
      !this.mining.isAutoDigging &&
      !this.inventory.isSearching &&
      !this.abilities.isClimbing &&
      !this.abilities.isPlantingSeeds
    ) {
      this.sprite.clearTint();
    }

    // Movement input (with cooldown)
    if (!this.movement.canMove()) {
      return;
    }

    const isSprinting = keys.shift && keys.shift.isDown;

    if (cursors.left.isDown) {
      this.movement.tryMove(-1, 0, isSprinting);
    } else if (cursors.right.isDown) {
      this.movement.tryMove(1, 0, isSprinting);
    } else if (cursors.up.isDown) {
      this.movement.tryMove(0, -1, isSprinting);
    } else if (cursors.down.isDown) {
      this.movement.tryMove(0, 1, isSprinting);
    }
  }

  /**
   * Update auto-digging behavior
   */
  updateAutoDig(time: number, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    const moveRequest = this.mining.updateAutoDig(time, keys, this.movement.isMoving);

    if (moveRequest && moveRequest.shouldMove) {
      const moveDx = moveRequest.targetX - this.gridX;
      if (this.sprite && moveDx !== 0) {
        this.sprite.setFlipX(moveDx < 0);
      }
      this.movement.isMoving = true;
      this.movement.moveTarget = {
        x: moveRequest.targetX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
        y: moveRequest.targetY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      };
      this.movement.currentMoveSpeed = moveRequest.speed;
    }
  }

  /**
   * Update search behavior
   */
  updateSearch(time: number): void {
    const moveRequest = this.inventory.updateSearch(time, this.movement.isMoving);

    if (moveRequest && moveRequest.shouldMove) {
      const moveDx = moveRequest.targetX - this.gridX;
      if (this.sprite && moveDx !== 0) {
        this.sprite.setFlipX(moveDx < 0);
      }
      this.movement.isMoving = true;
      this.movement.moveTarget = {
        x: moveRequest.targetX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
        y: moveRequest.targetY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      };
      this.movement.currentMoveSpeed = moveRequest.speed;
    }
  }

  /**
   * Start auto-digging in a direction
   */
  startAutoDig(direction: { dx: number; dy: number }): void {
    this.stopAllActions();
    this.mining.startAutoDig(direction);

    // Reset movement state
    this.movement.isMoving = false;
    this.movement.moveTarget = null;
  }

  /**
   * Inflict damage to the character. If health <= 0, kill the character.
   */
  takeDamage(amount: number): void {
    if (this.isDead) {
      return;
    }
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.kill();
    }
  }

  /**
   * Kill the character (set isDead, stop actions, update sprite, etc.)
   */
  kill(): void {
    if (this.isDead) {
      return;
    }
    this.isDead = true;
    this.stopAllActions();
    if (this.sprite) {
      this.sprite.setTint(0x222222);
      this.sprite.setAlpha(0.5);
      // Prevent clicking dead characters
      if (this.sprite.input && this.sprite.disableInteractive) {
        this.sprite.disableInteractive();
      }
    }
    // Optionally: play death animation, sound, etc.
  }
}
