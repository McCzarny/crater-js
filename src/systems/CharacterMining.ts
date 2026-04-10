import { CONFIG } from '../config';
import type TerrainSystem from './TerrainSystem';
import type { ICharacter } from '../types/game-types';

/**
 * Character type for mining system
 */
type Character = ICharacter;

/**
 * Interface for mining target position
 */
interface MiningTarget {
  gridX: number;
  gridY: number;
}

/**
 * Interface for auto-dig direction
 */
interface Direction {
  dx: number;
  dy: number;
}

/**
 * Interface for movement result
 */
interface MovementResult {
  shouldMove: boolean;
  targetX: number;
  targetY: number;
  speed: number;
}

/**
 * CharacterMining - handles all mining-related logic for characters
 * Includes: manual mining, auto-digging, mining indicators
 */
export default class CharacterMining {
  character: Character;
  scene: Phaser.Scene;
  terrainSystem: TerrainSystem;

  // Mining state
  isMining: boolean;
  miningStartTime: number;
  miningTarget: MiningTarget | null;

  // Auto-dig state
  isAutoDigging: boolean;
  autoDigDirection: Direction | null;
  lastDigTime: number;
  needsInitialDigTime: boolean;

  // Mining indicator
  miningIndicator: Phaser.GameObjects.Rectangle | null;
  miningIndicatorTarget: { x: number; y: number } | null;

  constructor(character: Character) {
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
  startMining(): void {
    const char = this.character;

    const directions: Direction[] = [
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
  continueMining(): void {
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
  stopMining(): void {
    if (!this.isMining) {
      return;
    }

    this.isMining = false;
    this.miningTarget = null;
  }

  /**
   * Start auto-digging in a direction
   */
  startAutoDig(direction: Direction): void {
    console.log('Starting auto-dig in direction:', direction);

    this.isAutoDigging = true;
    this.autoDigDirection = direction;
    this.needsInitialDigTime = true;
    this.character.sprite.setTint(0xffaa00);
    if (direction.dx !== 0) {
      this.character.sprite.setFlipX(direction.dx < 0);
    }
  }

  /**
   * Change auto-dig direction while it's active
   */
  setAutoDigDirection(direction: Direction): void {
    if (
      !this.isAutoDigging ||
      (direction.dx === this.autoDigDirection!.dx && direction.dy === this.autoDigDirection!.dy)
    ) {
      return;
    }

    console.log('Changing auto-dig direction to:', direction);
    this.autoDigDirection = direction;
    this.needsInitialDigTime = true;
    this.hideMiningIndicator();
    if (direction.dx !== 0) {
      this.character.sprite.setFlipX(direction.dx < 0);
    }
  }

  /**
   * Stop auto-digging
   */
  stopAutoDig(): void {
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
  updateAutoDig(
    time: number,
    keys: Record<string, Phaser.Input.Keyboard.Key>,
    isMoving: boolean,
  ): MovementResult | null | void {
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
    // - if you cannot dig downwards, try to dig horizontally anyway (e.g. a boulder is blocking the downward path)
    let dirToUse = this.autoDigDirection;
    if (dirToUse && dirToUse.dx !== 0 && dirToUse.dy !== 0) {
      const blockBehind = this.terrainSystem.getBlockAt(char.gridX - dirToUse.dx, char.gridY);
      if (blockBehind && blockBehind.solid) {
        dirToUse = { dx: dirToUse.dx, dy: 0 };
      } else {
        const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
        if (blockBelow && blockBelow.breakable) {
          dirToUse = { dx: 0, dy: 1 };
        } else {
          dirToUse = { dx: dirToUse.dx, dy: 0 };
        }
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
      // Use shared walking logic (automatic mode: no falling off ledges)
      const dest =
        char.movement &&
        char.movement.canWalkTo(
          char.gridX,
          char.gridY,
          targetX,
          targetY,
          dirToUse.dx,
          dirToUse.dy,
          'automatic',
        );
      if (!dest) {
        console.log('Auto-dig stopped: walk check failed for non-solid block');
        this.stopAutoDig();
        return;
      }
      char.gridX = dest.tileX;
      char.gridY = dest.tileY;
      this.hideMiningIndicator();
      return {
        shouldMove: true,
        targetX: dest.tileX,
        targetY: dest.tileY,
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
    // Use shared walking logic (automatic mode: no falling off ledges)
    const dest =
      char.movement &&
      char.movement.canWalkTo(
        char.gridX,
        char.gridY,
        targetX,
        targetY,
        dirToUse.dx,
        dirToUse.dy,
        'automatic',
      );
    if (!dest) {
      // Mined but can't safely step in - stop auto-dig
      console.log('Auto-dig stopped: cannot safely enter mined space');
      this.stopAutoDig();
      return;
    }
    char.gridX = dest.tileX;
    char.gridY = dest.tileY;

    // Trigger smooth movement
    return {
      shouldMove: true,
      targetX: dest.tileX,
      targetY: dest.tileY,
      speed: char.moveSpeed,
    };
  }

  /**
   * Show mining indicator on target block
   */
  showMiningIndicator(gridX: number, gridY: number): void {
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
  hideMiningIndicator(): void {
    if (this.miningIndicator) {
      this.miningIndicator.destroy();
      this.miningIndicator = null;
      this.miningIndicatorTarget = null;
    }
  }

  /**
   * Scan in a direction until a solid, breakable block is found, then start auto-digging.
   * If no diggable block is found, do nothing.
   */
  findAndStartAutoDig(direction: Direction, maxSteps: number = 10): void {
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
