import type Phaser from 'phaser';
import { CONFIG } from '../config';

export interface Trait {
  id: string;
  name: string;
  description: string;
  /** null = common trait (available to all races) */
  race: string | null;
  /** IDs of traits that cannot coexist with this one */
  cancels: string[];
}

const TRAIT_DEFINITIONS: readonly Trait[] = [
  // Common traits
  {
    id: 'fast',
    name: 'Fast',
    description: '+20% movement speed, +20% stamina drain',
    race: null,
    cancels: ['slow'],
  },
  {
    id: 'slow',
    name: 'Slow',
    description: '-20% movement speed, -20% stamina drain',
    race: null,
    cancels: ['fast'],
  },
  {
    id: 'strong',
    name: 'Strong',
    description: '+20% max health, +20% stamina drain',
    race: null,
    cancels: ['weak'],
  },
  {
    id: 'weak',
    name: 'Weak',
    description: '-20% max health, -20% stamina drain',
    race: null,
    cancels: ['strong'],
  },
  {
    id: 'agile',
    name: 'Agile',
    description: '+20% climbing speed, +20% stamina drain',
    race: null,
    cancels: ['clumsy'],
  },
  {
    id: 'clumsy',
    name: 'Clumsy',
    description: '-20% climbing speed, -20% stamina drain',
    race: null,
    cancels: ['agile'],
  },
  {
    id: 'resilient',
    name: 'Resilient',
    description: '-20% damage taken, +20% stamina drain',
    race: null,
    cancels: ['fragile'],
  },
  {
    id: 'fragile',
    name: 'Fragile',
    description: '+20% damage taken, -20% stamina drain',
    race: null,
    cancels: ['resilient'],
  },
  // Petal-specific traits
  {
    id: 'photosynthesis',
    name: 'Photosynthesis',
    description: 'Regenerate 1% HP/sec on surface tiles',
    race: 'petal',
    cancels: [],
  },
  {
    id: 'thorny',
    name: 'Thorny',
    description: 'Reflects 5 damage to melee attackers',
    race: 'petal',
    cancels: [],
  },
  // Tribe-specific traits
  {
    id: 'sharp_picks',
    name: 'Sharp Picks',
    description: '+20% digging speed',
    race: 'tribe',
    cancels: [],
  },
  {
    id: 'bargainer',
    name: 'Bargainer',
    description: '-10% essence cost when buying items',
    race: 'tribe',
    cancels: [],
  },
  // Fungus-specific traits
  {
    id: 'spore_cloud',
    name: 'Spore Cloud',
    description: 'On death, damages nearby enemies for 5 seconds',
    race: 'fungus',
    cancels: [],
  },
  {
    id: 'worm_eater',
    name: 'Worm Eater',
    description: 'Regain 2% HP when mining a tile',
    race: 'fungus',
    cancels: [],
  },
];

const COMMON_TRAITS = TRAIT_DEFINITIONS.filter(t => t.race === null);
const RACE_TRAITS = new Map<string, Trait[]>();
for (const t of TRAIT_DEFINITIONS) {
  if (t.race !== null) {
    const list = RACE_TRAITS.get(t.race) ?? [];
    list.push(t);
    RACE_TRAITS.set(t.race, list);
  }
}

// Constants for trait effects
const THORNY_REFLECT_DAMAGE = 5;
const SPORE_CLOUD_RANGE = 3; // Chebyshev distance in tiles
const SPORE_CLOUD_DURATION_MS = 5000;
const SPORE_CLOUD_TICK_INTERVAL_MS = 500;
const SPORE_CLOUD_DAMAGE_PER_TICK = 5;

type MinimalCharacter = {
  gridX: number;
  gridY: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  stopAllActions: () => void;
  sprite: { setAlpha: (a: number) => void };
};

type MinimalMob = {
  gridX: number;
  gridY: number;
  health: number;
  isDead: boolean;
  destroy: () => void;
};

/**
 * CharacterTraits – randomly assigned modifiers that make each character unique.
 * Traits can affect stats, add per-frame effects, and trigger on specific events.
 */
export default class CharacterTraits {
  readonly traits: Trait[];

  constructor(race: string) {
    this.traits = CharacterTraits.assignForRace(race);
  }

  has(id: string): boolean {
    return this.traits.some(t => t.id === id);
  }

  // ── Stat multipliers ────────────────────────────────────────────────────────

  speedMultiplier(): number {
    if (this.has('fast')) {
      return 1.2;
    }
    if (this.has('slow')) {
      return 0.8;
    }
    return 1.0;
  }

  staminaDrainMultiplier(): number {
    let m = 1.0;
    if (this.has('fast')) {
      m *= 1.2;
    }
    if (this.has('slow')) {
      m *= 0.8;
    }
    if (this.has('strong')) {
      m *= 1.2;
    }
    if (this.has('weak')) {
      m *= 0.8;
    }
    if (this.has('agile')) {
      m *= 1.2;
    }
    if (this.has('clumsy')) {
      m *= 0.8;
    }
    if (this.has('resilient')) {
      m *= 1.2;
    }
    if (this.has('fragile')) {
      m *= 0.8;
    }
    return m;
  }

  maxHealthMultiplier(): number {
    if (this.has('strong')) {
      return 1.2;
    }
    if (this.has('weak')) {
      return 0.8;
    }
    return 1.0;
  }

  damageTakenMultiplier(): number {
    if (this.has('resilient')) {
      return 0.8;
    }
    if (this.has('fragile')) {
      return 1.2;
    }
    return 1.0;
  }

  miningSpeedMultiplier(): number {
    if (this.has('sharp_picks')) {
      return 1.2;
    }
    return 1.0;
  }

  essenceCostMultiplier(): number {
    if (this.has('bargainer')) {
      return 0.9;
    }
    return 1.0;
  }

  climbingSpeedMultiplier(): number {
    if (this.has('agile')) {
      return 1.2;
    }
    if (this.has('clumsy')) {
      return 0.8;
    }
    return 1.0;
  }

  // ── Event hooks ─────────────────────────────────────────────────────────────

  /**
   * Per-frame update. Applies Photosynthesis health regen when on surface.
   */
  update(
    delta: number,
    character: Pick<MinimalCharacter, 'gridY' | 'health' | 'maxHealth' | 'isDead'>,
  ): void {
    if (character.isDead) {
      return;
    }
    if (this.has('photosynthesis') && character.gridY <= CONFIG.SURFACE_HEIGHT) {
      const regenPerSec = character.maxHealth * 0.01;
      character.health = Math.min(
        character.maxHealth,
        character.health + regenPerSec * (delta / 1000),
      );
    }
  }

  /**
   * Called when this character is hit in melee.
   * Returns the damage to reflect back to the attacker (Thorny trait), or 0.
   */
  onMeleeHit(): number {
    return this.has('thorny') ? THORNY_REFLECT_DAMAGE : 0;
  }

  /**
   * Called after this character successfully mines a tile (Worm Eater).
   */
  onTileMined(character: Pick<MinimalCharacter, 'health' | 'maxHealth'>): void {
    if (this.has('worm_eater')) {
      character.health = Math.min(
        character.maxHealth,
        character.health + character.maxHealth * 0.02,
      );
    }
  }

  /**
   * Called when this character dies. Activates Spore Cloud if present.
   */
  onDeath(
    character: Pick<MinimalCharacter, 'gridX' | 'gridY'>,
    scene: Phaser.Scene,
    allCharacters: MinimalCharacter[],
    allMobs: MinimalMob[],
  ): void {
    if (!this.has('spore_cloud')) {
      return;
    }

    const tickCount = SPORE_CLOUD_DURATION_MS / SPORE_CLOUD_TICK_INTERVAL_MS;
    scene.time.addEvent({
      delay: SPORE_CLOUD_TICK_INTERVAL_MS,
      repeat: tickCount - 1,
      callback: () => {
        const cx = character.gridX;
        const cy = character.gridY;

        for (const char of allCharacters) {
          if (char.isDead) {
            continue;
          }
          const dist = Math.max(Math.abs(char.gridX - cx), Math.abs(char.gridY - cy));
          if (dist <= SPORE_CLOUD_RANGE) {
            char.health = Math.max(0, char.health - SPORE_CLOUD_DAMAGE_PER_TICK);
            if (char.health <= 0 && !char.isDead) {
              char.isDead = true;
              char.stopAllActions();
              char.sprite.setAlpha(0.45);
            }
          }
        }

        for (const mob of allMobs) {
          if (mob.isDead) {
            continue;
          }
          const dist = Math.max(Math.abs(mob.gridX - cx), Math.abs(mob.gridY - cy));
          if (dist <= SPORE_CLOUD_RANGE) {
            mob.health = Math.max(0, mob.health - SPORE_CLOUD_DAMAGE_PER_TICK);
            if (mob.health <= 0 && !mob.isDead) {
              mob.isDead = true;
              scene.time.delayedCall(150, () => mob.destroy());
            }
          }
        }
      },
    });
  }

  // ── Assignment ───────────────────────────────────────────────────────────────

  /**
   * Randomly assigns traits for a character of the given race.
   * Each slot has a 50% chance of being filled; duplicates are not allowed.
   */
  static assignForRace(race: string): Trait[] {
    const pool = [...COMMON_TRAITS, ...(RACE_TRAITS.get(race) ?? [])];
    const result: Trait[] = [];
    // Track IDs excluded from the pool due to cancellation
    const excluded = new Set<string>();
    for (let slot = 0; slot < 4; slot++) {
      if (Math.random() < 0.5) {
        const remaining = pool.filter(t => !result.includes(t) && !excluded.has(t.id));
        if (remaining.length === 0) {
          break;
        }
        const picked = remaining[Math.floor(Math.random() * remaining.length)];
        result.push(picked);
        // Remove picked trait and all traits it cancels from further consideration
        excluded.add(picked.id);
        for (const cancelledId of picked.cancels) {
          excluded.add(cancelledId);
        }
      }
    }
    return result;
  }
}
