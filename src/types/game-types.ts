/**
 * Shared type definitions for the game
 * This file contains interfaces used across multiple modules to avoid circular dependencies
 */

import type Phaser from 'phaser';

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
 * Character Inventory interface
 */
export interface ICharacterInventory {
  tryPickup?: () => void;
  isSearching?: boolean;
  stopSearch?: () => void;
  startSearch?: () => void;
}

/**
 * Character Mining interface
 */
export interface ICharacterMining {
  startAutoDig?: (direction: { dx: number; dy: number }) => void;
}

/**
 * Character Movement interface
 */
export interface ICharacterMovement {
  tryMove?: (dx: number, dy: number, isSprinting: boolean) => void;
}

/**
 * Character Abilities interface
 */
export interface ICharacterAbilities {
  getAbilities: () => IAbility[];
}

/**
 * Character Sprite interface
 */
export interface ICharacterSprite {
  clearTint?: () => void;
}

/**
 * Character interface - represents a game character
 */
export interface ICharacter {
  race: string;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  patience?: number;
  maxPatience?: number;
  stopAllActions?: () => void;
  abilities?: ICharacterAbilities;
  inventory?: ICharacterInventory;
  mining?: ICharacterMining;
  movement?: ICharacterMovement;
  sprite?: ICharacterSprite;
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
