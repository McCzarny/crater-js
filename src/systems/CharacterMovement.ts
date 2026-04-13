import { CONFIG } from '../config';
import type TerrainSystem from './TerrainSystem';
import type { ICharacter } from '../types/game-types';

/**
 * Interface for move target position
 */
interface MoveTarget {
  x: number;
  y: number;
}

/**
 * Character type for movement system
 */
type Character = ICharacter;

/**
 * CharacterMovement - handles all movement-related logic for characters
 * Includes: grid movement, smooth movement animation, falling physics
 */
export default class CharacterMovement {
  character: Character;
  scene: Phaser.Scene;
  terrainSystem: TerrainSystem;

  // Movement state
  isMoving: boolean;
  moveTarget: MoveTarget | null;
  currentMoveSpeed: number;
  lastMoveTime: number;
  moveCooldown: number;

  // Falling state
  isFalling: boolean;
  fallSpeed: number;

  constructor(character: Character) {
    this.character = character;
    this.scene = character.scene;
    this.terrainSystem = character.terrainSystem;

    // Movement state
    this.isMoving = false;
    this.moveTarget = null;
    this.currentMoveSpeed = 0;
    this.lastMoveTime = 0;
    this.moveCooldown = 150; // ms between moves

    // Falling state
    this.isFalling = false;
    this.fallSpeed = 300; // pixels per second
  }

  /**
   * Check whether a character can walk to (targetX, targetY) from (fromX, fromY).
   *
   * Handles:
   *  - Passability of the target tile
   *  - Automatic 1-tile step-up when moving sideways into a wall
   *  - Fall safety:
   *      'automatic' - refuses to move if there is 2 or more tiles of fall distance
   *      'manual'    - allows falling
   *
   * Returns null when the walk is not possible, or a { tileX, tileY } object with the
   * resolved destination (may differ from target when stepping up).
   */
  canWalkTo(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    dx: number,
    dy: number,
    mode: 'manual' | 'automatic',
  ): { tileX: number; tileY: number } | null {
    // Bounds check
    if (
      targetX < 0 ||
      targetX >= CONFIG.WORLD_WIDTH ||
      targetY < 0 ||
      targetY >= CONFIG.WORLD_HEIGHT
    ) {
      return null;
    }

    const targetBlock = this.terrainSystem.getBlockAt(targetX, targetY);

    if (targetBlock && targetBlock.solid) {
      // Auto-climb: moving sideways into a wall - try to step 1 tile up
      if (dx !== 0 && dy === 0) {
        const tileAboveChar = this.terrainSystem.getBlockAt(fromX, fromY - 1);
        const charAbovePassable = !tileAboveChar || !tileAboveChar.solid;
        const tileAboveTarget = this.terrainSystem.getBlockAt(targetX, targetY - 1);
        const targetAbovePassable = !tileAboveTarget || !tileAboveTarget.solid;

        if (charAbovePassable && targetAbovePassable && targetY - 1 >= 0) {
          // Step up: wall tile below the climb destination is always solid — safe
          return { tileX: targetX, tileY: targetY - 1 };
        }
      }
      return null;
    }

    // Target tile is passable - check fall safety for horizontal movement
    if (dy === 0) {
      const tileBelowTarget = this.terrainSystem.getBlockAt(targetX, targetY + 1);

      if (tileBelowTarget && tileBelowTarget.solid) {
        return { tileX: targetX, tileY: targetY };
      }

      // No solid ground directly below target - check if it's a safe fall (1 tile) or not
      const groundDirect = this.terrainSystem.getBlockAt(targetX, targetY + 2);
      const hasSolidDirectly = groundDirect && groundDirect.solid;

      if (mode === 'automatic') {
        // Automatic: refuse to walk off any ledge
        if (!hasSolidDirectly) {
          return null;
        }
      }
    }

    return { tileX: targetX, tileY: targetY };
  }

  /**
   * Try to move in a direction (grid-based)
   */
  tryMove(dx: number, dy: number, isSprinting: boolean): boolean {
    const char = this.character;
    const isClimbing = char.abilities && char.abilities.isClimbing;
    const isOnLadder = this.isCharacterOnLadder();

    // Calculate current actual tile position based on sprite's position
    const currentTileX = char.gridX; // Math.floor(char.sprite.x / CONFIG.BLOCK_SIZE);
    const currentTileY = char.gridY; // Math.floor(char.sprite.y / CONFIG.BLOCK_SIZE);

    const targetX = currentTileX + dx;
    const targetY = currentTileY + dy;

    // When climbing, allow moving 1 tile above the surface to be able to climb onto the surface
    if (isClimbing && targetY <= CONFIG.SURFACE_HEIGHT - 2) {
      return false;
    }

    // For horizontal movement (not on ladders/climbing), delegate to canWalkTo
    if (dy === 0 && !isClimbing && !isOnLadder) {
      const dest = this.canWalkTo(currentTileX, currentTileY, targetX, targetY, dx, dy, 'manual');
      if (!dest) {
        return false;
      }

      const isStepUp = dest.tileY !== targetY;

      char.gridX = dest.tileX;
      char.gridY = dest.tileY;
      this.isMoving = true;
      this.moveTarget = {
        x: dest.tileX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
        y: dest.tileY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      };

      if (char.sprite && dx !== 0) {
        char.sprite.setFlipX(dx < 0);
      }

      let baseSpeed = isSprinting ? char.moveSpeed * char.sprintMultiplier : char.moveSpeed;
      if (isStepUp) {
        baseSpeed *= 0.85; // 15% slower when stepping up
      }
      if (char.abilities) {
        baseSpeed *= char.abilities.getMovementSpeedMultiplier();
      }

      this.currentMoveSpeed = baseSpeed;
      this.lastMoveTime = Date.now();
      return true;
    }

    // Vertical movement (ladders / climbing)

    // Bounds check
    if (
      targetX < 0 ||
      targetX >= CONFIG.WORLD_WIDTH ||
      targetY < 0 ||
      targetY >= CONFIG.WORLD_HEIGHT
    ) {
      return false;
    }

    const targetBlock = this.terrainSystem.getBlockAt(targetX, targetY);
    if (targetBlock && targetBlock.solid) {
      return false;
    }

    // Check if target has a ladder
    const targetHasLadder = this.terrainSystem.hasLadder(targetX, targetY);

    // Special handling for vertical movement
    // Skip ground check when: climbing OR on ladder AND moving to ladder
    if (dy !== 0 && !isClimbing && !isOnLadder && !targetHasLadder) {
      const blockBelow = this.terrainSystem.getBlockAt(currentTileX, currentTileY + 1);
      if (dy < 0 && (!blockBelow || !blockBelow.solid)) {
        console.log('Blocked upward movement: no ground below');
        return false;
      }
    }

    if (dy < 0 && !targetHasLadder && !isClimbing) {
      console.log('Blocked upward movement: no ladder to climb');
      return false;
    }

    // Start moving
    char.gridX = targetX;
    char.gridY = targetY;
    this.isMoving = true;
    this.moveTarget = {
      x: targetX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      y: targetY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
    };

    // Calculate movement speed
    let baseSpeed = isSprinting ? char.moveSpeed * char.sprintMultiplier : char.moveSpeed;

    // Apply ability speed multiplier (e.g., climbing is slower)
    if (char.abilities) {
      baseSpeed *= char.abilities.getMovementSpeedMultiplier();
    }

    // Apply ladder speed multiplier if on ladder or moving to ladder (0.7x speed)
    if (isOnLadder || targetHasLadder) {
      baseSpeed *= 0.7;
    }

    this.currentMoveSpeed = baseSpeed;
    this.lastMoveTime = Date.now();

    return true;
  }

  /**
   * Update smooth movement to target
   */
  updateSmoothMove(delta: number): void {
    if (!this.isMoving || !this.moveTarget) {
      return;
    }

    const char = this.character;
    const dx = this.moveTarget.x - char.sprite.x;
    const dy = this.moveTarget.y - char.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      // Reached target
      char.sprite.x = this.moveTarget.x;
      char.sprite.y = this.moveTarget.y;
      this.isMoving = false;
      this.moveTarget = null;

      // Check if we should fall now that movement is complete (only if not prevented by abilities)
      if (!char.abilities || !char.abilities.shouldPreventFalling()) {
        // Check if there's a ladder at current position OR solid ground below
        const hasLadder = this.isCharacterOnLadder();
        const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
        const hasSolidGround = blockBelow && blockBelow.solid;

        if (!hasLadder && !hasSolidGround) {
          // No support - start falling
          this.startFalling();
          return;
        }
      }

      return;
    }

    // Move towards target
    const horizontalRatio = Math.min((this.currentMoveSpeed * delta) / 1000 / distance, 1);
    const verticalRatio = Math.min((this.fallSpeed * delta) / 1000 / distance, 1);

    char.sprite.x += dx * horizontalRatio;
    char.sprite.y += dy * verticalRatio;
  }

  /**
   * Check if character should fall
   */
  shouldFall(): boolean {
    if (this.isMoving || this.isFalling) {
      return false;
    }

    // Don't fall if on a ladder
    if (this.isCharacterOnLadder()) {
      return false;
    }

    const char = this.character;
    const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
    return !blockBelow || !blockBelow.solid;
  }

  /**
   * Check if character is currently on a ladder
   */
  isCharacterOnLadder(): boolean {
    const char = this.character;
    return this.terrainSystem.hasLadder(char.gridX, char.gridY);
  }

  /* Check if there's a ladder at a relative position from the character */
  isLadderAtRelativePosition(dx: number, dy: number): boolean {
    const char = this.character;
    return this.terrainSystem.hasLadder(char.gridX + dx, char.gridY + dy);
  }

  /**
   * Start falling
   */
  startFalling(): void {
    const char = this.character;
    this.isFalling = true;
    char.gridY++;
    this.moveTarget = {
      x: char.gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
      y: char.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
    };
  }

  /**
   * Update falling movement
   */
  updateFalling(delta: number): void {
    if (!this.moveTarget) {
      this.isFalling = false;
      return;
    }

    const char = this.character;
    const dx = this.moveTarget.x - char.sprite.x;
    const dy = this.moveTarget.y - char.sprite.y;

    if (dy < 1) {
      // Reached ground or next tile
      char.sprite.x = this.moveTarget.x;
      char.sprite.y = this.moveTarget.y;
      this.isFalling = false;
      this.moveTarget = null;

      // Check if we should continue falling
      if (this.shouldFall()) {
        this.startFalling();
      }
      return;
    }

    // Fall towards target
    const moveAmount = (this.fallSpeed * delta) / 1000;
    char.sprite.y += Math.min(moveAmount, dy);

    // Adjust horizontal position to center on grid
    if (Math.abs(dx) > 0.5) {
      const horizontalSpeed = char.moveSpeed * 2;
      const horizontalAmount = (horizontalSpeed * delta) / 1000;
      const horizontalRatio = Math.min(horizontalAmount / Math.abs(dx), 1);
      char.sprite.x += dx * horizontalRatio;
    } else {
      char.sprite.x = this.moveTarget.x;
    }
  }

  /**
   * Check if movement input is allowed
   */
  canMove(): boolean {
    const now = Date.now();
    return !this.isMoving && now - this.lastMoveTime >= this.moveCooldown;
  }

  /**
   * Snap character to grid position
   */
  snapToGrid(): void {
    const char = this.character;
    this.isMoving = false;
    this.moveTarget = null;
    char.sprite.x = char.gridX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    char.sprite.y = char.gridY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
  }

  stopMovement(): void {
    this.isMoving = false;
    this.moveTarget = null;
  }
}
