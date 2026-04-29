import Phaser from 'phaser';
import type Character from '../entities/Character';
import type { IMob } from '../types/game-types';

/** Chebyshev distance at which a melee attack can land (1 = same tile or adjacent). */
const ATTACK_RANGE = 1;

/** Duration of the hit-flash tint in milliseconds. */
const HIT_FLASH_MS = 150;

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * CombatSystem – handles automatic melee combat between:
 *   • Characters of different races
 *   • Characters and Essence Spiders
 *
 * Attack is triggered automatically when enemies are within ATTACK_RANGE tiles
 * (Chebyshev distance). Each combatant has an independent attack cooldown.
 */
export default class CombatSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Advance all combat for one frame.
   * @param characters  All characters currently in the scene.
   * @param mobs        All mobs currently in the scene (alive or dead).
   * @param delta       Frame time in milliseconds.
   */
  update(characters: Character[], mobs: IMob[], delta: number): void {
    const liveMobs = mobs.filter(m => !m.isDead);

    // ── Character attacks ───────────────────────────────────────────────────
    for (const attacker of characters) {
      if (attacker.isDead) {
        continue;
      }

      // Tick cooldown down
      attacker.attackCooldown = Math.max(0, attacker.attackCooldown - delta);
      if (attacker.attackCooldown > 0) {
        continue;
      }

      // Find the nearest valid target (different-race character or mob)
      let nearestDist = Infinity;
      let targetChar: Character | null = null;
      let targetMob: IMob | null = null;

      for (const defender of characters) {
        if (defender === attacker || defender.isDead || defender.race === attacker.race) {
          continue;
        }
        const d = chebyshev(attacker.gridX, attacker.gridY, defender.gridX, defender.gridY);
        if (d <= ATTACK_RANGE && d < nearestDist) {
          nearestDist = d;
          targetChar = defender;
          targetMob = null;
        }
      }

      for (const mob of liveMobs) {
        const d = chebyshev(attacker.gridX, attacker.gridY, mob.gridX, mob.gridY);
        if (d <= ATTACK_RANGE && d < nearestDist) {
          nearestDist = d;
          targetMob = mob;
          targetChar = null;
        }
      }

      if (targetChar) {
        this.hitCharacter(attacker.attackPower, targetChar);
        attacker.attackCooldown = attacker.attackInterval;
      } else if (targetMob) {
        this.hitMob(attacker.attackPower, targetMob);
        attacker.attackCooldown = attacker.attackInterval;
      }
    }

    // ── Mob attacks ─────────────────────────────────────────────────────────
    for (const mob of liveMobs) {
      mob.attackCooldown = Math.max(0, mob.attackCooldown - delta);
      if (mob.attackCooldown > 0) {
        continue;
      }

      // Find the nearest character in range
      let nearestDist = Infinity;
      let target: Character | null = null;

      for (const character of characters) {
        if (character.isDead) {
          continue;
        }
        const d = chebyshev(mob.gridX, mob.gridY, character.gridX, character.gridY);
        if (d <= ATTACK_RANGE && d < nearestDist) {
          nearestDist = d;
          target = character;
        }
      }

      if (target) {
        this.hitCharacter(mob.attackPower, target);
        mob.attackCooldown = mob.attackInterval;
      }
    }
  }

  // ── Damage helpers ─────────────────────────────────────────────────────────

  private hitCharacter(damage: number, target: Character): void {
    target.health = Math.max(0, target.health - damage);
    this.flash(target.sprite, 0xff2222, () => target.isDead);

    if (target.health <= 0 && !target.isDead) {
      target.isDead = true;
      target.stopAllActions();
      target.sprite.setAlpha(0.45);
      this.dropCharacterLoot(target);
    }
  }

  private hitMob(damage: number, mob: IMob): void {
    mob.health = Math.max(0, mob.health - damage);
    this.flash(mob.sprite, 0xff6600, () => mob.isDead);

    if (mob.health <= 0 && !mob.isDead) {
      mob.isDead = true;
      this.scene.time.delayedCall(HIT_FLASH_MS + 50, () => {
        mob.destroy();
      });
    }
  }

  /**
   * Drop all inventory items and essence from a character onto the ground.
   */
  private dropCharacterLoot(target: Character): void {
    const terrainSystem = target.terrainSystem;
    if (!terrainSystem) {
      return;
    }

    const x = target.gridX;
    const y = target.gridY;

    // Drop all inventory items
    if (target.inventory) {
      const inv = target.inventory.inventory;
      for (let i = 0; i < inv.length; i++) {
        const itemType = inv[i];
        if (itemType) {
          inv[i] = null;
          terrainSystem.spawnItem(x, y, itemType);
        }
      }
    }

    // Drop essence as an item if the character has any
    if (target.essence > 0) {
      const essenceType = terrainSystem.itemManager.getEssenceTypeForAmount(target.essence);
      terrainSystem.spawnItem(x, y, essenceType);
      target.essence = 0;
    }

    // Notify UI of inventory and essence changes
    this.scene.game.events.emit('inventoryChanged', target.inventory?.inventory ?? []);
    this.scene.game.events.emit('essenceChanged', target.essence, target.maxEssence);
  }

  /**
   * Briefly tint a sprite a hit colour, then restore the correct resting tint
   * (grey for dead entities, cleared for living ones).
   */
  private flash(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    color: number,
    isDead: () => boolean,
  ): void {
    if (!sprite.active) {
      return;
    }
    sprite.setTint(color);

    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (!sprite.active) {
        return;
      }
      if (isDead()) {
        sprite.setTint(0x666666);
      } else {
        sprite.clearTint();
      }
    });
  }
}
