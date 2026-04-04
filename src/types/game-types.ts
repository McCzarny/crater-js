/**
 * Shared type definitions for the game
 * This file contains interfaces used across multiple modules to avoid circular dependencies
 */

import type Phaser from 'phaser';
import type TerrainSystem from '../systems/TerrainSystem';

/**
 * Ability interface - represents a character ability
 */
export interface IAbility {
  character: unknown;
  active: boolean;
  cooldownRemaining: number;
  name(): string;
  texture(): string | null;
  description(): string;
  canActivate(): boolean;
  activate(): boolean;
  deactivate(): void;
  isActive(): boolean;
  movementSpeedMultiplier(): number;
  canMove(dx: number, dy: number): boolean;
  shouldPreventFalling(): boolean;
  update(time: number, delta: number): void;
  progress(): number;
}

/**
 * Character Inventory interface (UI-facing)
 */
export interface ICharacterInventory {
  tryPickup?: () => void;
  isSearching?: boolean;
  stopSearch?: () => void;
  startSearch?: () => void;
}

/**
 * Character Mining interface (UI-facing)
 */
export interface ICharacterMining {
  startAutoDig?: (direction: { dx: number; dy: number }) => void;
}

/**
 * Character Movement interface (UI-facing)
 */
export interface ICharacterMovement {
  tryMove?: (dx: number, dy: number, isSprinting: boolean) => void;
}

/**
 * Character Abilities interface (UI-facing)
 */
export interface ICharacterAbilities {
  getAbilities: () => IAbility[];
}

/**
 * Character Sprite interface (UI-facing)
 */
export interface ICharacterSprite {
  clearTint?: () => void;
}

/**
 * Character interface — the single canonical type for all consumers.
 * UI-only fields (e.g. patience, essence) are optional so system code doesn't need them.
 * Entity-level fields (e.g. scene, gridX) are optional so UI code doesn't need them.
 */
export interface ICharacter {
  isDead?: boolean;
  race: string;

  // Entity / system properties (optional for UI consumers)
  scene?: Phaser.Scene;
  terrainSystem?: TerrainSystem;
  gridX?: number;
  gridY?: number;
  moveSpeed?: number;
  sprintMultiplier?: number;
  digInterval?: number;
  fastDigInterval?: number;

  // Stats
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  patience: number;
  maxPatience: number;
  essence: number;
  maxEssence: number;

  // Actions
  stopAllActions?: () => void;

  // Sprite
  sprite?: Phaser.GameObjects.Sprite & ICharacterSprite;

  // Subsystems
  abilities?: ICharacterAbilities & {
    isClimbing?: boolean;
    isPlantingSeeds?: boolean;
    getMovementSpeedMultiplier?: () => number;
    shouldPreventFalling?: () => boolean;
  };
  inventory?: ICharacterInventory;
  mining?: ICharacterMining;
  movement?: ICharacterMovement & {
    tryMove: (dx: number, dy: number, isSprinting: boolean) => boolean;
  };
}

/**
 * Icon element return type
 */
export interface IconElement {
  bg: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Sprite;
  label?: Phaser.GameObjects.Text;
}

/**
 * Bar element for HUD
 */
export interface BarElement {
  bg: Phaser.GameObjects.Rectangle;
  fg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}
