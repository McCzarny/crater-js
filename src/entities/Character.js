import { CONFIG } from '../config.js';
import CharacterMovement from '../systems/CharacterMovement.js';
import CharacterMining from '../systems/CharacterMining.js';
import CharacterInventory from '../systems/CharacterInventory.js';
import CharacterAbilities from '../systems/CharacterAbilities.js';

/**
 * Character class - represents a playable character
 * Now uses composition pattern with separate systems for movement, mining, and inventory
 */
export default class Character {
  constructor(scene, x, y, race) {
    this.scene = scene;
    this.race = race;

    // Get race stats
    const raceConfig = CONFIG.RACES[race] || CONFIG.RACES.tribe;
    this.raceConfig = raceConfig;

    // Grid position (in tiles)
    this.gridX = x;
    this.gridY = y;

    // Get terrain system reference
    this.terrainSystem = scene.registry.get('terrainSystem');

    // Create sprite
    this.sprite = scene.add.sprite(
      this.gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      this.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      race,
    );
    this.sprite.setDisplaySize(CONFIG.CHAR_SIZE, CONFIG.CHAR_SIZE);
    this.sprite.setDepth(1000);

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
  }

  /**
   * Stop all active actions
   */
  stopAllActions() {
    this.mining.stopAutoDig();
    this.inventory.stopSearch();
    this.mining.stopMining();
    this.abilities.deactivateAll();
    this.sprite.clearTint();
  }

  /**
   * Update character state
   */
  update(cursors, keys, time, delta) {
    // Update abilities
    this.abilities.update(time, delta);

    // Update visual feedback for abilities
    if (this.abilities.isClimbing) {
      this.sprite.setTint(0x00aaff); // Blue tint for climbing
    } else if (this.abilities.isPlantingSeeds) {
      this.sprite.setTint(0x00ff00); // Green tint for seed planting
    }

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
    } else {
      this.stamina += this.staminaRegenPerSecond * deltaSecEarly;
      if (this.stamina > this.maxStamina) {
        this.stamina = this.maxStamina;
      }
    }

    // Spacebar to stop all actions
    if (keys.space && keys.space.isDown) {
      this.stopAllActions();
    }

    // Search mode takes highest priority
    if (this.inventory.isSearching) {
      this.updateSearch(time);
      return;
    }

    // Handle falling (only if not prevented by abilities)
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

    // Stop active actions when trying to move manually (except climbing)
    if (cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown) {
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
  updateAutoDig(time, keys) {
    const moveRequest = this.mining.updateAutoDig(time, keys, this.movement.isMoving);

    if (moveRequest && moveRequest.shouldMove) {
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
  updateSearch(time) {
    const moveRequest = this.inventory.updateSearch(time, this.movement.isMoving);

    if (moveRequest && moveRequest.shouldMove) {
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
  startAutoDig(direction) {
    this.stopAllActions();
    this.mining.startAutoDig(direction);

    // Reset movement state
    this.movement.isMoving = false;
    this.movement.moveTarget = null;
  }
}
