import { CONFIG } from '../config';
import type TerrainSystem from './TerrainSystem';

/**
 * Interface for move target position
 */
interface MoveTarget {
  x: number;
  y: number;
}

/**
 * Forward declaration for Character (will be fully typed when Character.ts is created)
 * For now, we define the minimal interface needed by CharacterMovement
 */
interface Character {
  scene: any; // Phaser.Scene
  terrainSystem: TerrainSystem;
  sprite: any; // Phaser.GameObjects.Sprite
  gridX: number;
  gridY: number;
  moveSpeed: number;
  sprintMultiplier: number;
  abilities?: {
    isClimbing: boolean;
    getMovementSpeedMultiplier(): number;
    shouldPreventFalling(): boolean;
  };
}

/**
 * CharacterMovement - handles all movement-related logic for characters
 * Includes: grid movement, smooth movement animation, falling physics
 */
export default class CharacterMovement {
  character: Character;
  scene: any; // Phaser.Scene
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
   * Try to move in a direction (grid-based)
   */
  tryMove(dx: number, dy: number, isSprinting: boolean): boolean {
    const char = this.character;
    const isClimbing = char.abilities && char.abilities.isClimbing;
    const isOnVine = this.isCharacterOnVine();

    // Calculate current actual tile position based on sprite's position
    const currentTileX = Math.floor(char.sprite.x / CONFIG.BLOCK_SIZE);
    const currentTileY = Math.floor(char.sprite.y / CONFIG.BLOCK_SIZE);

    const targetX = currentTileX + dx;
    const targetY = currentTileY + dy;

    // Check if target is in bounds
    if (
      targetX < 0 ||
      targetX >= CONFIG.WORLD_WIDTH ||
      targetY < 0 ||
      targetY >= CONFIG.WORLD_HEIGHT
    ) {
      return false;
    }

    // When climbing, allow moving 1 tile above the surface to be able to climb onto the surface
    if (isClimbing && targetY <= CONFIG.SURFACE_HEIGHT - 2) {
      return false;
    }

    // Check if target tile is solid
    const targetBlock = this.terrainSystem.getBlockAt(targetX, targetY);
    if (targetBlock && targetBlock.solid) {
      // Auto-climb: If moving sideways into a wall, check if we can step up
      if (dx !== 0 && dy === 0) {
        // Check if tile above character is not solid
        const tileAboveChar = this.terrainSystem.getBlockAt(currentTileX, currentTileY - 1);
        const charTilePassable = !tileAboveChar || !tileAboveChar.solid;

        // Check if tile above target is not solid
        const tileAboveTarget = this.terrainSystem.getBlockAt(targetX, targetY - 1);
        const targetTilePassable = !tileAboveTarget || !tileAboveTarget.solid;

        // If both tiles above are passable, climb up instead
        if (charTilePassable && targetTilePassable) {
          // Adjust target to climb one tile up
          const climbTargetY = targetY - 1;

          // Verify the climb target is in bounds
          if (climbTargetY >= 0) {
            // Update target to the tile above
            char.gridX = targetX;
            char.gridY = climbTargetY;
            this.isMoving = true;
            this.moveTarget = {
              x: targetX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
              y: climbTargetY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
            };

            // Calculate movement speed (slightly slower for climbing)
            let baseSpeed = isSprinting ? char.moveSpeed * char.sprintMultiplier : char.moveSpeed;
            baseSpeed *= 0.85; // 15% slower when climbing over walls

            if (char.abilities) {
              baseSpeed *= char.abilities.getMovementSpeedMultiplier();
            }

            this.currentMoveSpeed = baseSpeed;
            this.lastMoveTime = Date.now();

            return true;
          }
        }
      }

      return false;
    }

    // Check if target has a vine
    const targetHasVine = this.terrainSystem.hasVine(targetX, targetY);

    // Debug logging for vine climbing
    if (dy < 0 && (isOnVine || targetHasVine)) {
      console.log('Vine climbing attempt:', {
        isOnVine,
        targetHasVine,
        currentPos: { x: currentTileX, y: currentTileY },
        targetPos: { x: targetX, y: targetY },
      });
    }

    // Special handling for vertical movement
    // Skip ground check when: climbing OR on vine AND moving to vine
    if (dy !== 0 && !isClimbing && !isOnVine && !targetHasVine) {
      const blockBelow = this.terrainSystem.getBlockAt(currentTileX, currentTileY + 1);
      if (dy < 0 && (!blockBelow || !blockBelow.solid)) {
        console.log('Blocked upward movement: no ground below');
        return false;
      }
    }

    if (dy < 0 && !targetHasVine && !isClimbing) {
      console.log('Blocked upward movement: no vine to climb');
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

    // Apply vine speed multiplier if on vine or moving to vine (0.7x speed)
    if (isOnVine || targetHasVine) {
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
        // Check if there's a vine at current position OR solid ground below
        const hasVine = this.isCharacterOnVine();
        const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
        const hasSolidGround = blockBelow && blockBelow.solid;

        if (!hasVine && !hasSolidGround) {
          // No support - start falling
          this.startFalling();
          return;
        }
      }

      return;
    }

    // Move towards target
    const moveAmount = (this.currentMoveSpeed * delta) / 1000;
    const ratio = Math.min(moveAmount / distance, 1);

    char.sprite.x += dx * ratio;
    char.sprite.y += dy * ratio;

    // Check if sprite's current position has support (only if not prevented by abilities)
    if (!char.abilities || !char.abilities.shouldPreventFalling()) {
      const currentTileX = Math.floor(char.sprite.x / CONFIG.BLOCK_SIZE);
      const currentTileY = Math.floor(char.sprite.y / CONFIG.BLOCK_SIZE);

      // Check if current sprite position has vine OR solid ground below
      const hasVine = this.terrainSystem.hasVine(currentTileX, currentTileY);
      const blockBelow = this.terrainSystem.getBlockAt(currentTileX, currentTileY + 1);
      const hasSolidGround = blockBelow && blockBelow.solid;

      if (!hasVine && !hasSolidGround) {
        // No support at current position - update grid and start falling
        char.gridX = currentTileX;
        char.gridY = currentTileY;
        this.isMoving = false;
        this.moveTarget = null;
        this.startFalling();
      }
    }
  }

  /**
   * Check if character should fall
   */
  shouldFall(): boolean {
    if (this.isMoving || this.isFalling) {
      return false;
    }

    // Don't fall if on a vine
    if (this.isCharacterOnVine()) {
      return false;
    }

    const char = this.character;
    const blockBelow = this.terrainSystem.getBlockAt(char.gridX, char.gridY + 1);
    return !blockBelow || !blockBelow.solid;
  }

  /**
   * Check if character is currently on a vine
   */
  isCharacterOnVine(): boolean {
    const char = this.character;
    return this.terrainSystem.hasVine(char.gridX, char.gridY);
  }

  /* Check if there's a vine at a relative position from the character */
  isVineAtRelativePosition(dx: number, dy: number): boolean {
    const char = this.character;
    return this.terrainSystem.hasVine(char.gridX + dx, char.gridY + dy);
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
    return now - this.lastMoveTime >= this.moveCooldown;
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
}
