import { CONFIG } from '../config.js';
import { TileRegistry } from './TileTypes.js';

/**
 * CharacterMining - handles all mining-related logic for characters
 * Includes: manual mining, auto-digging, mining indicators
 */
export default class CharacterMining {
  constructor(character) {
    this.character = character;
    this.scene = character.scene;
    this.terrainSystem = character.terrainSystem;

    // Mining state
    this.isMining = false;
    this.miningStartTime = 0;
    this.miningTarget = null;

    // Auto-dig state
    this.isAutoDigging = false;
    this.autoDigDirection = null;
    this.lastDigTime = 0;
    this.needsInitialDigTime = false;

    // Mining indicator
    this.miningIndicator = null;
    this.miningIndicatorTarget = null;
  }

  /**
   * Start manual mining operation
   */
  startMining() {
    const char = this.character;

    const directions = [
      { dx: 0, dy: 1 }, // Below
      { dx: 1, dy: 0 }, // Right
      { dx: -1, dy: 0 }, // Left
      { dx: 0, dy: -1 }, // Above
    ];

    for (const dir of directions) {
      const targetX = char.gridX + dir.dx;
      const targetY = char.gridY + dir.dy;
      const block = this.terrainSystem.getBlockAt(targetX, targetY);

      if (block && block.solid && block.breakable) {
        this.isMining = true;
        this.miningStartTime = Date.now();
        this.miningTarget = { gridX: targetX, gridY: targetY };
        char.sprite.setTint(0xffaa00);
        break;
      }
    }
  }

  /**
   * Continue mining the current block
   */
  continueMining() {
    if (!this.miningTarget) {
      return;
    }

    const char = this.character;

    // Check if there's still solid ground below (unless climbing)
    if (!char.abilities || !char.abilities.shouldPreventFalling()) {
      const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
      if (!blockBelow || !blockBelow.solid) {
        // Ground below disappeared, stop mining and let character fall
        this.stopMining();
        return;
      }
    }

    // If out of stamina, stop mining
    if (char.stamina <= 0) {
      this.stopMining();
      return;
    }

    // Slow digging when stamina < 50%
    const staminaMultiplier = char.stamina < char.maxStamina * 0.5 ? 2.0 : 1.0;
    const required = char.digInterval * staminaMultiplier;
    const elapsed = Date.now() - this.miningStartTime;

    if (elapsed >= required) {
      this.terrainSystem.mineBlockAt(this.miningTarget.gridX, this.miningTarget.gridY);
      this.stopMining();
    }
  }

  /**
   * Stop mining
   */
  stopMining() {
    if (!this.isMining) {
      return;
    }

    this.isMining = false;
    this.miningTarget = null;
  }

  /**
   * Start auto-digging in a direction
   */
  startAutoDig(direction) {
    console.log('Starting auto-dig in direction:', direction);

    this.isAutoDigging = true;
    this.autoDigDirection = direction;
    this.needsInitialDigTime = true;
    this.character.sprite.setTint(0xffaa00);
  }

  /**
   * Change auto-dig direction while it's active
   */
  setAutoDigDirection(direction) {
    if (
      !this.isAutoDigging ||
      (direction.dx === this.autoDigDirection.dx && direction.dy === this.autoDigDirection.dy)
    ) {
      return;
    }

    console.log('Changing auto-dig direction to:', direction);
    this.autoDigDirection = direction;
    this.needsInitialDigTime = true;
    this.hideMiningIndicator();
  }

  /**
   * Stop auto-digging
   */
  stopAutoDig() {
    if (!this.isAutoDigging) {
      return;
    }

    console.log('Stopping auto-dig');
    this.isAutoDigging = false;
    this.autoDigDirection = null;
    this.isMining = false;
    this.hideMiningIndicator();
  }

  /**
   * Update auto-digging behavior
   */
  updateAutoDig(time, keys, isMoving) {
    if (!this.autoDigDirection) {
      this.stopAutoDig();
      return;
    }

    // If out of stamina, stop auto-digging
    const char = this.character;
    if (char.stamina <= 0) {
      this.stopAutoDig();
      return;
    }
    // Initialize dig time on first update
    if (this.needsInitialDigTime) {
      this.lastDigTime = time;
      this.needsInitialDigTime = false;
    }

    // Wait for movement to complete
    if (isMoving) {
      return;
    }

    // Check if there's still solid ground below (unless climbing)
    if (!char.abilities || !char.abilities.shouldPreventFalling()) {
      const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
      if (!blockBelow || !blockBelow.solid) {
        // Ground below disappeared, stop auto-digging and let character fall
        console.log('Auto-dig stopped: ground below disappeared');
        this.stopAutoDig();
        return;
      }
    }

    // Adjust interval when stamina is low (slower digging)
    const baseInterval =
      keys && keys.shift && keys.shift.isDown ? char.fastDigInterval : char.digInterval;
    const staminaMultiplier = char.stamina < char.maxStamina * 0.5 ? 2.0 : 1.0;
    const currentDigInterval = baseInterval * staminaMultiplier;

    // Support diagonal auto-dig directions by translating into a concrete
    // horizontal or vertical action based on the tile above the character.
    // Semantics: For diagonal requests (dx != 0 && dy != 0):
    // - if there is a solid block behind the character, dig horizontally in the requested direction
    // - otherwise, dig downwards
    let dirToUse = this.autoDigDirection;
    if (dirToUse && dirToUse.dx !== 0 && dirToUse.dy !== 0) {
      const blockBehind = this.terrainSystem.getBlockAt(char.gridX - dirToUse.dx, char.gridY);
      if (blockBehind && blockBehind.solid) {
        dirToUse = { dx: dirToUse.dx, dy: 0 };
      } else {
        dirToUse = { dx: 0, dy: 1 };
      }
    }

    const targetX = char.gridX + dirToUse.dx;
    const targetY = char.gridY + dirToUse.dy;

    console.log('Auto-dig attempting:', {
      requestedDirection: this.autoDigDirection,
      effectiveDirection: dirToUse,
      currentPos: { x: char.gridX, y: char.gridY },
      targetPos: { x: targetX, y: targetY },
    });

    // Check bounds
    if (
      targetX < 0 ||
      targetX >= CONFIG.WORLD_WIDTH ||
      targetY < 0 ||
      targetY >= CONFIG.WORLD_HEIGHT
    ) {
      console.log('Auto-dig stopped: out of bounds');
      this.stopAutoDig();
      return;
    }

    const block = this.terrainSystem.getBlockAt(targetX, targetY);

    // Stop if no block or unbreakable
    if (!block || (block.solid && !block.breakable)) {
      console.log('Auto-dig stopped: hit non-mineable block', block?.type || 'empty', block);
      this.stopAutoDig();
      return;
    }

    // If the block is not solid, move into the direction instead of mining
    if (!block.solid) {
      console.log('Auto-dig moving into non-solid block at:', targetX, targetY);
      char.gridX = targetX;
      char.gridY = targetY;
      this.hideMiningIndicator();
      return {
        shouldMove: true,
        targetX: targetX,
        targetY: targetY,
        speed: char.moveSpeed,
      };
    }

    // Show mining indicator
    if (
      !this.miningIndicator ||
      !this.miningIndicatorTarget ||
      this.miningIndicatorTarget.x !== targetX ||
      this.miningIndicatorTarget.y !== targetY
    ) {
      this.showMiningIndicator(targetX, targetY);
    }

    // Check if enough time has passed
    if (time - this.lastDigTime < currentDigInterval) {
      return;
    }

    // Mine the block
    console.log('Auto-dig mining at:', targetX, targetY, 'block type:', block.type);
    this.terrainSystem.mineBlockAt(targetX, targetY);
    this.hideMiningIndicator();
    this.lastDigTime = time;

    // Re-check the target tile after environment reactions (e.g. boulders)
    const postBlock = this.terrainSystem.getBlockAt(targetX, targetY);
    if (postBlock && postBlock.solid) {
      console.log(
        'Auto-dig aborted: tile occupied after mining (likely boulder):',
        targetX,
        targetY,
      );
      this.stopAutoDig();
      return;
    }

    // Update character position to move into the mined space
    char.gridX = targetX;
    char.gridY = targetY;

    // Trigger smooth movement
    return {
      shouldMove: true,
      targetX: targetX,
      targetY: targetY,
      speed: char.moveSpeed,
    };
  }

  /**
   * Show mining indicator on target block
   */
  showMiningIndicator(gridX, gridY) {
    this.hideMiningIndicator();

    const worldX = gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    const worldY = gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    this.miningIndicator = this.scene.add.rectangle(
      worldX,
      worldY,
      CONFIG.BLOCK_SIZE,
      CONFIG.BLOCK_SIZE,
      0xffff00,
      0.6,
    );
    this.miningIndicator.setDepth(999);
    this.miningIndicatorTarget = { x: gridX, y: gridY };

    // Create blinking effect
    this.scene.tweens.add({
      targets: this.miningIndicator,
      alpha: { from: 0.6, to: 0.1 },
      duration: 150,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Hide mining indicator
   */
  hideMiningIndicator() {
    if (this.miningIndicator) {
      this.miningIndicator.destroy();
      this.miningIndicator = null;
      this.miningIndicatorTarget = null;
    }
  }

  /**
   * Scan in a direction until a solid, breakable block is found, then start auto-digging.
   * If no diggable block is found, do nothing.
   * @param {{dx:number,dy:number}} direction
   * @param {number} [maxSteps=10]
   */
  findAndStartAutoDig(direction, maxSteps = 10) {
    const char = this.character;
    let x = char.gridX;
    let y = char.gridY;
    for (let step = 1; step <= maxSteps; step++) {
      x += direction.dx;
      y += direction.dy;
      const block = this.terrainSystem.getBlockAt(x, y);
      if (block && block.solid) {
        if (block.breakable) {
          // Move character to just before the block if possible
          const prevX = x - direction.dx;
          const prevY = y - direction.dy;
          if (char.movement && char.movement.tryMove) {
            char.movement.tryMove(prevX - char.gridX, prevY - char.gridY, false);
          } else {
            char.gridX = prevX;
            char.gridY = prevY;
          }
          this.startAutoDig(direction);
        }
        break;
      }
    }
  }
}
