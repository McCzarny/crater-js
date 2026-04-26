/**
 * Shared type definitions for the game
 * This file contains interfaces used across multiple modules to avoid circular dependencies
 */

import type Phaser from 'phaser';
import type TerrainSystem from '../systems/TerrainSystem';

/**
 * Common interface for any entity that participates in melee combat.
 * Both player characters and mobs implement (or structurally satisfy) this.
 */
export interface ICombatant {
  isDead: boolean;
  health: number;
  maxHealth: number;
  gridX: number;
  gridY: number;
  /** Rendered sprite used for hit-flash effects. */
  sprite: Phaser.GameObjects.Image;
  attackPower: number;
  attackInterval: number;
  attackCooldown: number;
}

/**
 * Interface for hostile mob entities (non-player combatants).
 * Extends ICombatant with lifecycle cleanup.
 */
export interface IMob extends ICombatant {
  destroy(): void;
}

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
  tryPickup?: () => boolean;
  placeLadder: (slotIndex: number) => boolean;
  useItem: (slotIndex: number) => boolean;
  isSearching?: boolean;
  stopSearch?: () => void;
  startSearch?: () => void;
  inventory: (string | null)[];
}

/**
 * Character Mining interface (UI-facing)
 */
export interface ICharacterMining {
  startAutoDig?: (direction: { dx: number; dy: number }) => void;
  isMining?: boolean;
  isAutoDigging?: boolean;
}

/**
 * Character Movement interface (UI-facing)
 */
export interface ICharacterMovement {
  tryMove?: (dx: number, dy: number, isSprinting: boolean) => void;
  isMoving?: boolean;
}

/**
 * Character Abilities interface (UI-facing)
 */
export interface ICharacterAbilities {
  getAbilities: () => IAbility[];
  anyAbilityActive: () => boolean;
}

/**
 * Character Sprite interface (UI-facing)
 */
export interface ICharacterSprite {
  clearTint?: () => void;
}

/**
 * Character interface - the single canonical type for all consumers.
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
  abilities: ICharacterAbilities & {
    isClimbing?: boolean;
    isPlantingSeeds?: boolean;
    getMovementSpeedMultiplier?: () => number;
    shouldPreventFalling?: () => boolean;
  };
  inventory?: ICharacterInventory;
  mining?: ICharacterMining;
  movement?: ICharacterMovement & {
    tryMove: (dx: number, dy: number, isSprinting: boolean) => boolean;
    canWalkTo: (
      fromX: number,
      fromY: number,
      targetX: number,
      targetY: number,
      dx: number,
      dy: number,
      mode: 'manual' | 'automatic',
    ) => { tileX: number; tileY: number } | null;
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

export interface BaseItem {
  name: string;
  description: string;
  texture: string;
}

export interface TradableConfig extends BaseItem {
  baseValue: number;
  usable: boolean;
}
