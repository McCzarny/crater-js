import { CONFIG } from '../config.js';

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
    if (!this.miningTarget) {return;}

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

    const elapsed = Date.now() - this.miningStartTime;

    if (elapsed >= char.digInterval) {
      this.terrainSystem.mineBlockAt(this.miningTarget.gridX, this.miningTarget.gridY);
      this.stopMining();
    }
  }

  /**
   * Stop mining
   */
  stopMining() {
    if (!this.isMining) {return;}

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
    )
    {return;}

    console.log('Changing auto-dig direction to:', direction);
    this.autoDigDirection = direction;
    this.needsInitialDigTime = true;
    this.hideMiningIndicator();
  }

  /**
   * Stop auto-digging
   */
  stopAutoDig() {
    if (!this.isAutoDigging) {return;}

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

    // Initialize dig time on first update
    if (this.needsInitialDigTime) {
      this.lastDigTime = time;
      this.needsInitialDigTime = false;
    }

    // Wait for movement to complete
    if (isMoving) {return;}

    const char = this.character;

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

    const currentDigInterval =
      keys && keys.shift && keys.shift.isDown ? char.fastDigInterval : char.digInterval;

    const targetX = char.gridX + this.autoDigDirection.dx;
    const targetY = char.gridY + this.autoDigDirection.dy;

    console.log('Auto-dig attempting:', {
      direction: this.autoDigDirection,
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

    // Stop if no block, not solid, or unbreakable
    if (!block || !block.solid || !block.breakable) {
      console.log('Auto-dig stopped: hit non-mineable block', block?.type || 'empty', block);
      this.stopAutoDig();
      return;
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
}
