import { CONFIG } from '../config';
import type { ICharacter } from '../types/game-types';
import { getNextLadderCoordinate, canPlaceLadderAt } from './LadderUtils';

/**
 * Character type for abilities system
 */
type Character = ICharacter;

/**
 * Base Ability class - defines the interface for all character abilities
 */
export class Ability {
  character: Character;
  active: boolean;
  cooldownRemaining: number;

  constructor(character: Character) {
    this.character = character;
    this.active = false;
    this.cooldownRemaining = 0;
  }

  /**
   * Get the ability name
   */
  name(): string {
    return 'Unknown Ability';
  }

  texture(): string | null {
    return null; // Override in subclasses if they have an icon
  }

  /**
   * Get the ability description
   */
  description(): string {
    return '';
  }

  /**
   * Check if this ability can be activated right now
   */
  canActivate(): boolean {
    return false;
  }

  /**
   * Activate the ability
   */
  activate(): boolean {
    if (this.canActivate()) {
      this.character.stopAllActions();
    }
    return false;
  }

  /**
   * Deactivate the ability
   */
  deactivate(): void {
    this.active = false;
  }

  /**
   * Check if ability is currently active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Get movement speed multiplier when this ability is active
   */
  movementSpeedMultiplier(): number {
    return 1.0;
  }

  /**
   * Check if character can move in a specific direction while ability is active
   * Returns true to allow movement, false to block
   */
  canMove(_dx: number, _dy: number): boolean {
    return true;
  }

  /**
   * Check if character should fall when ability is active
   */
  shouldPreventFalling(): boolean {
    return false;
  }

  /**
   * Update ability state (called each frame)
   */
  update(_time: number, _delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Get progress of the ability (0-1). Override in subclasses if needed.
   * Used for showing progress overlays in UI.
   */
  progress(): number {
    return 0;
  }
}

/**
 * Teleportation Ability - allows Tribe of the Mask to teleport to base camp
 */
class TeleportationAbility extends Ability {
  cooldownTime: number;
  lastUseTime: number;
  cooldownRemaining: number;

  constructor(character: Character) {
    super(character);
    this.cooldownTime = 60000; // 60 seconds cooldown
    this.lastUseTime = 0;
    this.cooldownRemaining = 0;
  }

  name(): string {
    return 'Teleportation';
  }

  texture(): string {
    return 'hud_teleport';
  }

  update(_time: number, _delta: number): void {
    const currentTime = Date.now();
    const timeSinceLastUse = currentTime - this.lastUseTime;
    this.cooldownRemaining = Math.max(0, this.cooldownTime - timeSinceLastUse);
  }

  progress(): number {
    const currentTime = Date.now();
    const timeSinceLastUse = currentTime - this.lastUseTime;
    if (timeSinceLastUse >= this.cooldownTime) {
      return 0;
    }
    return timeSinceLastUse / this.cooldownTime;
  }

  description(): string {
    return 'Teleport to base camp (60s cooldown)';
  }

  canActivate(): boolean {
    const currentTime = Date.now();
    const timeSinceLastUse = currentTime - this.lastUseTime;
    return timeSinceLastUse >= this.cooldownTime && this.character.stamina > 0;
  }

  activate(): boolean {
    super.activate();
    if (!this.canActivate()) {
      return false;
    }

    // Teleportation costs all stamina
    this.character.stamina = 0;

    // Get base system from scene registry
    const baseSystem = this.character.scene.registry.get('baseSystem');
    if (!baseSystem) {
      console.error('BaseSystem not found');
      return false;
    }

    // Get the base for this character's race
    const base = baseSystem.getBase(this.character.race);
    if (!base) {
      console.error(`Base not found for race: ${this.character.race}`);
      return false;
    }

    // Teleport to base center, slightly above
    const targetX = base.centerGridX;
    const targetY = base.centerGridY - 1; // Slightly above the center

    // Update character position
    this.character.gridX = targetX;
    this.character.gridY = targetY;

    // Update sprite position
    this.character.sprite.x = targetX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;
    this.character.sprite.y = targetY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    // Stop any ongoing actions
    this.character.stopAllActions();

    // Record the use time
    this.lastUseTime = Date.now();

    console.log(`Teleported to base at (${targetX}, ${targetY})`);

    // Teleportation is instant, don't set active state
    return true;
  }
}

/**
 * Climbing Ability - allows Cult of the Spore to climb walls
 */
class ClimbingAbility extends Ability {
  climbingSpeedMultiplier: number;
  staminaDrainPerSecond: number;

  constructor(character: Character) {
    super(character);
    this.climbingSpeedMultiplier = 0.5; // 50% of normal speed
    this.staminaDrainPerSecond = 5; // 5 stamina per second while climbing
  }

  name(): string {
    return 'Climbing';
  }

  texture(): string {
    return 'hud_climb';
  }

  description(): string {
    return 'Climb walls and prevent falling in tunnels';
  }

  canActivate(): boolean {
    const char = this.character;
    // Can only climb 1 tile above the surface to allow climbing onto the surface
    return char.gridY > CONFIG.SURFACE_HEIGHT - 2 && char.stamina > 0;
  }

  activate(): boolean {
    super.activate();
    if (!this.canActivate()) {
      return false;
    }
    this.active = true;
    console.log('Climbing ability activated');
    return true;
  }

  movementSpeedMultiplier(): number {
    return this.climbingSpeedMultiplier;
  }

  shouldPreventFalling(): boolean {
    return true; // Climbing prevents falling
  }

  canMove(_dx: number, _dy: number): boolean {
    // When climbing, allow movement in any direction (up, down, left, right)
    // Check will be handled in CharacterMovement to ensure target is empty
    return true;
  }

  update(_time: number, delta: number): void {
    if (!this.active) {
      return;
    }
    const deltaSec = delta / 1000;
    this.character.stamina -= this.staminaDrainPerSecond * deltaSec;
    if (this.character.stamina <= 0) {
      this.character.stamina = 0;
      this.deactivate();
    }
  }
}

/**
 * Seed Planting Ability - allows Order of the Seed to plant vines
 */
class SeedPlantingAbility extends Ability {
  vineSpeedMultiplier: number;
  growthInterval: number;
  staminaDrainPerSecond: number;

  // Growth state
  isGrowing: boolean;
  currentVineY: number | null;
  lastGrowthTime: number;

  constructor(character: Character) {
    super(character);
    this.vineSpeedMultiplier = 0.7; // 70% of normal speed when on vines
    this.growthInterval = 10000; // 10 seconds per vine growth
    this.staminaDrainPerSecond = 10; // 10 stamina per second while vines are active

    // Growth state
    this.isGrowing = false;
    this.currentVineY = null;
    this.lastGrowthTime = 0;
  }

  progress(): number {
    if (!this.isGrowing) {
      return 0;
    }
    const currentTime = Date.now();
    const elapsed = currentTime - this.lastGrowthTime;
    return Math.min(elapsed / this.growthInterval, 1);
  }

  name(): string {
    return 'Seed Planting';
  }

  texture(): string {
    return 'hud_seed_planting';
  }

  description(): string {
    return 'Plant seeds that grow into climbable vines';
  }

  canActivate(): boolean {
    const char = this.character;

    // Must be underground to plant seeds
    if (char.gridY <= CONFIG.SURFACE_HEIGHT - 2) {
      return false;
    }

    // Must have stamina
    if (char.stamina <= 0) {
      return false;
    }

    // Check if current tile or any tile above has space for vines
    return (
      getNextLadderCoordinate(
        this.character.gridX,
        this.character.gridY,
        this.character.terrainSystem,
      ) !== null
    );
  }

  activate(): boolean {
    super.activate();
    if (!this.canActivate()) {
      return false;
    }

    const startPos = getNextLadderCoordinate(
      this.character.gridX,
      this.character.gridY,
      this.character.terrainSystem,
    );
    if (!startPos) {
      return false;
    }

    this.active = true;
    this.isGrowing = true;
    this.currentVineY = startPos.y;
    this.lastGrowthTime = Date.now();

    console.log('Seed planting started at:', startPos);
    return true;
  }

  deactivate(): void {
    super.deactivate();
    this.active = false;
    this.isGrowing = false;
    this.currentVineY = null;
    console.log('Seed planting stopped');
  }

  movementSpeedMultiplier(): number {
    // This affects movement speed when the ability itself is active, not when on vines
    return 1.0;
  }

  shouldPreventFalling(): boolean {
    return false; // Seed planting doesn't prevent falling
  }

  /**
   * Update vine growth and drain stamina
   */
  update(_time: number, delta: number): void {
    if (!this.isGrowing || this.currentVineY === null) {
      return;
    }

    // Drain stamina while vines are active
    const deltaSec = delta / 1000;
    this.character.stamina -= this.staminaDrainPerSecond * deltaSec;
    if (this.character.stamina <= 0) {
      this.character.stamina = 0;
      this.deactivate();
      return;
    }

    const terrain = this.character.terrainSystem;

    // Check if enough time has passed for next growth
    const currentTime = Date.now();
    if (currentTime - this.lastGrowthTime < this.growthInterval) {
      return;
    }

    // Stop if reached surface
    if (!canPlaceLadderAt(this.character.gridX, this.currentVineY, terrain)) {
      console.log('Cannot grow further, stopping vine growth');
      this.deactivate();
      return;
    }

    // Grow vine upward
    const success = terrain.addLadder(this.character.gridX, this.currentVineY, /*isVine:*/ true);
    if (success) {
      console.log('Vine grew to:', this.character.gridX, this.currentVineY);
      this.currentVineY =
        getNextLadderCoordinate(this.character.gridX, this.currentVineY, terrain)?.y || null;
      this.lastGrowthTime = currentTime;

      // Check if we can continue growing
      if (this.currentVineY === null) {
        console.log('Cannot grow further, stopping vine growth');
        this.deactivate();
        return;
      }
    } else {
      console.log('Failed to grow vine');
      this.deactivate();
    }
  }
}

/**
 * CharacterAbilities - manages all abilities for a character
 */
export default class CharacterAbilities {
  character: Character;
  abilities: Ability[];

  constructor(character: Character) {
    this.character = character;
    this.abilities = [];

    // Initialize race-specific abilities
    this.initializeAbilities();
  }

  /**
   * Initialize abilities based on character race
   */
  initializeAbilities(): void {
    const race = this.character.race;

    switch (race) {
      case 'fungus': // Cult of the Spore
        this.abilities.push(new ClimbingAbility(this.character));
        break;

      case 'tribe': // Tribe of the Mask
        this.abilities.push(new TeleportationAbility(this.character));
        break;

      case 'petal': // Order of the Seed
        this.abilities.push(new SeedPlantingAbility(this.character));
        break;
    }
  }

  /**
   * Get all available abilities
   */
  getAbilities(): Ability[] {
    return this.abilities;
  }

  /**
   * Get ability by index
   */
  getAbility(index: number): Ability | null {
    return this.abilities[index] || null;
  }

  /**
   * Toggle ability by index
   */
  toggleAbility(index: number): boolean {
    const ability = this.getAbility(index);
    if (!ability) {
      return false;
    }

    if (ability.isActive()) {
      ability.deactivate();
      return true;
    } else {
      // Deactivate all other abilities first
      this.deactivateAll();
      return ability.activate();
    }
  }

  anyAbilityActive(): boolean {
    return this.abilities.some(ability => ability.isActive());
  }

  /**
   * Deactivate all abilities
   */
  deactivateAll(): void {
    this.abilities.forEach(ability => ability.deactivate());
  }

  /**
   * Get currently active ability
   */
  getActiveAbility(): Ability | null {
    return this.abilities.find(ability => ability.isActive()) || null;
  }

  /**
   * Check if climbing is active
   */
  get isClimbing(): boolean {
    const activeAbility = this.getActiveAbility();
    return activeAbility instanceof ClimbingAbility && activeAbility.isActive();
  }

  /**
   * Check if seed planting is active
   */
  get isPlantingSeeds(): boolean {
    const activeAbility = this.getActiveAbility();
    return activeAbility instanceof SeedPlantingAbility && activeAbility.isActive();
  }

  /**
   * Get movement speed multiplier from active ability
   */
  getMovementSpeedMultiplier(): number {
    const activeAbility = this.getActiveAbility();
    return activeAbility ? activeAbility.movementSpeedMultiplier() : 1.0;
  }

  /**
   * Check if active ability prevents falling
   */
  shouldPreventFalling(): boolean {
    const activeAbility = this.getActiveAbility();
    return activeAbility ? activeAbility.shouldPreventFalling() : false;
  }

  /**
   * Update all abilities
   */
  update(time: number, delta: number): void {
    this.abilities.forEach(ability => ability.update(time, delta));
  }
}
