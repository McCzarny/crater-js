import { CONFIG } from '../config';
import type TerrainSystem from './TerrainSystem';

/**
 * Forward declaration for Character interface
 */
interface Character {
  scene: Phaser.Scene;
  terrainSystem: TerrainSystem;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  moveSpeed: number;
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
 * CharacterInventory - handles inventory and item collection logic
 * Includes: inventory management, item pickup, search mode
 */
export default class CharacterInventory {
  character: Character;
  scene: Phaser.Scene;
  terrainSystem: TerrainSystem;
  inventory: (string | null)[];

  // Search state
  isSearching: boolean;
  searchDirection: number;
  lastSearchMoveTime: number;
  searchMoveInterval: number;

  constructor(character: Character) {
    this.character = character;
    this.scene = character.scene;
    this.terrainSystem = character.terrainSystem;

    const numberOfSlots = CONFIG.MAX_ITEMS || 4;
    // Inventory - 2 slots
    this.inventory = new Array(numberOfSlots).fill(null);

    // Search state
    this.isSearching = false;
    this.searchDirection = 1; // 1 for right, -1 for left
    this.lastSearchMoveTime = 0;
    this.searchMoveInterval = 200; // ms between search moves
  }

  /**
   * Try to pick up an item at the character's position
   */
  tryPickup(): boolean {
    const char = this.character;

    // Check if inventory is full
    if (this.inventory.every(slot => slot !== null)) {
      console.log('Inventory is full!');
      return false;
    }

    // Get items at current position
    const items = this.terrainSystem.getItemsAt(char.gridX, char.gridY);

    if (items.length === 0) {
      console.log('No items here to pick up');
      return false;
    }

    // Pick up the first item
    const item = items[0];
    const removed = this.terrainSystem.removeItem(item.id);

    if (removed) {
      for (let i = 0; i < this.inventory.length; i++) {
        if (this.inventory[i] === null) {
          this.inventory[i] = removed.type;
          break;
        }
      }

      console.log('Picked up:', removed.type);

      // Emit event for UI update
      this.scene.game.events.emit('inventoryChanged', this.inventory);
      return true;
    }

    return false;
  }

  /**
   * Start searching for items
   */
  startSearch(): void {
    console.log('Starting search mode');
    this.isSearching = true;
    this.searchDirection = 1;
    this.lastSearchMoveTime = 0;
    this.character.sprite.setTint(0x00ffff);
  }

  /**
   * Stop searching
   */
  stopSearch(): void {
    if (!this.isSearching) {
      return;
    }

    console.log('Stopping search mode');
    this.isSearching = false;
  }

  /**
   * Update search behavior
   */
  updateSearch(time: number, isMoving: boolean): MovementResult | null {
    // Check if inventory is full
    if (this.inventory.every(slot => slot !== null)) {
      console.log('Search stopped: inventory full');
      this.stopSearch();
      return null;
    }

    // Wait for movement to complete
    if (isMoving) {
      return null;
    }

    const char = this.character;

    // Try to pick up any items at current position
    const items = this.terrainSystem.getItemsAt(char.gridX, char.gridY);
    if (items.length > 0) {
      this.tryPickup();
    }

    // Check if enough time has passed
    if (time - this.lastSearchMoveTime < this.searchMoveInterval) {
      return null;
    }

    // Try to move in search direction
    const targetX = char.gridX + this.searchDirection;
    const targetY = char.gridY;

    // Check bounds
    if (targetX < 0 || targetX >= CONFIG.WORLD_WIDTH) {
      this.searchDirection *= -1;
      this.lastSearchMoveTime = time;
      return null;
    }

    // Check if blocked by solid block
    const targetBlock = this.terrainSystem.getBlockAt(targetX, targetY);
    if (targetBlock && targetBlock.solid) {
      this.searchDirection *= -1;
      this.lastSearchMoveTime = time;
      return null;
    }

    // Check if there's ground below target
    const blockBelow = this.terrainSystem.getBlockAt(targetX, targetY + 1);
    if (!blockBelow || !blockBelow.solid) {
      this.searchDirection *= -1;
      this.lastSearchMoveTime = time;
      return null;
    }

    // Move to target
    char.gridX = targetX;
    char.gridY = targetY;
    this.lastSearchMoveTime = time;

    // Return movement request
    return {
      shouldMove: true,
      targetX: targetX,
      targetY: targetY,
      speed: char.moveSpeed,
    };
  }

  /**
   * Check if inventory has space
   */
  hasSpace(): boolean {
    return this.inventory.some(slot => slot === null);
  }

  /**
   * Check if inventory is full
   */
  isFull(): boolean {
    return this.inventory.every(slot => slot !== null);
  }
}
