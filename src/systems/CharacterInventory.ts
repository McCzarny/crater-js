import { CONFIG } from '../config';
import type TerrainSystem from './TerrainSystem';
import type { ICharacter } from '../types/game-types';

/**
 * Character type for inventory system
 */
type Character = ICharacter;

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
   * Check if an item type is essence
   */
  private isEssence(itemType: string): boolean {
    return itemType in CONFIG.ESSENCE;
  }

  /**
   * Try to absorb essence directly into the character's pool.
   * Returns true if absorbed, false if pool is full.
   */
  private tryAbsorbEssence(itemType: string): boolean {
    const char = this.character;
    if (char.essence >= char.maxEssence) {
      return false;
    }

    const essenceConfig = CONFIG.ESSENCE[itemType as keyof typeof CONFIG.ESSENCE];
    if (!essenceConfig) {
      return false;
    }

    const essenceValue = Phaser.Math.Between(essenceConfig.min_value, essenceConfig.max_value);

    char.essence = Math.min(char.essence + essenceValue, char.maxEssence);
    console.log('Absorbed essence:', itemType, '-> pool:', char.essence, '/', char.maxEssence);
    return true;
  }

  /**
   * Try to pick up an item at the character's position
   */
  tryPickup(): boolean {
    const char = this.character;

    // Get items at current position
    const items = this.terrainSystem.getItemsAt(char.gridX, char.gridY);

    if (items.length === 0) {
      console.log('No items here to pick up');
      return false;
    }

    // Try essence items first (they don't use inventory slots)
    for (const item of items) {
      if (this.isEssence(item.type) && this.tryAbsorbEssence(item.type)) {
        this.terrainSystem.removeItem(item.id);
        this.scene.game.events.emit('essenceChanged', char.essence, char.maxEssence);
        return true;
      }
    }

    // Then try non-essence items (need an inventory slot)
    if (this.inventory.every(slot => slot !== null)) {
      console.log('Inventory is full!');
      return false;
    }

    for (const item of items) {
      if (this.isEssence(item.type)) {
        continue; // skip essence (pool must be full if we got here)
      }

      const removed = this.terrainSystem.removeItem(item.id);
      if (removed) {
        for (let i = 0; i < this.inventory.length; i++) {
          if (this.inventory[i] === null) {
            this.inventory[i] = removed.type;
            break;
          }
        }

        console.log('Picked up:', removed.type);
        this.scene.game.events.emit('inventoryChanged', this.inventory);
        return true;
      }
    }

    return false;
  }

  /**
   * Drop an item from a specific inventory slot onto the ground
   */
  dropItem(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.inventory.length) {
      return false;
    }

    const itemType = this.inventory[slotIndex];
    if (!itemType) {
      return false;
    }

    // Remove from inventory
    this.inventory[slotIndex] = null;

    // Spawn item at character's position
    const char = this.character;
    this.terrainSystem.spawnItem(char.gridX, char.gridY, itemType);

    console.log('Dropped:', itemType, 'from slot', slotIndex);

    // Emit event for UI update
    this.scene.game.events.emit('inventoryChanged', this.inventory);
    return true;
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
    // Stop searching if inventory is full AND essence pool is full
    const inventoryFull = this.inventory.every(slot => slot !== null);
    const essenceFull = this.character.essence >= this.character.maxEssence;
    if (inventoryFull && essenceFull) {
      console.log('Search stopped: inventory and essence full');
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
