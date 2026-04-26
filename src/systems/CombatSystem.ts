import Phaser from 'phaser';
import type Character from '../entities/Character';
import type EssenceSpider from '../entities/EssenceSpider';

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
   * @param spiders     All spiders currently in the scene (alive or dead).
   * @param delta       Frame time in milliseconds.
   */
  update(characters: Character[], spiders: EssenceSpider[], delta: number): void {
    const liveSpiders = spiders.filter(s => !s.isDead);

    // ── Character attacks ───────────────────────────────────────────────────
    for (const attacker of characters) {
      if (attacker.isDead) continue;

      // Tick cooldown down
      attacker.attackCooldown = Math.max(0, attacker.attackCooldown - delta);
      if (attacker.attackCooldown > 0) continue;

      // Find the nearest valid target (different-race character or spider)
      let nearestDist = Infinity;
      let targetChar: Character | null = null;
      let targetSpider: EssenceSpider | null = null;

      for (const defender of characters) {
        if (defender === attacker || defender.isDead || defender.race === attacker.race) continue;
        const d = chebyshev(attacker.gridX, attacker.gridY, defender.gridX, defender.gridY);
        if (d <= ATTACK_RANGE && d < nearestDist) {
          nearestDist = d;
          targetChar = defender;
          targetSpider = null;
        }
      }

      for (const spider of liveSpiders) {
        const d = chebyshev(attacker.gridX, attacker.gridY, spider.gridX, spider.gridY);
        if (d <= ATTACK_RANGE && d < nearestDist) {
          nearestDist = d;
          targetSpider = spider;
          targetChar = null;
        }
      }

      if (targetChar) {
        this.hitCharacter(attacker.raceConfig.attackPower, targetChar);
        attacker.attackCooldown = attacker.raceConfig.attackInterval;
      } else if (targetSpider) {
        this.hitSpider(attacker.raceConfig.attackPower, targetSpider);
        attacker.attackCooldown = attacker.raceConfig.attackInterval;
      }
    }

    // ── Spider attacks ──────────────────────────────────────────────────────
    for (const spider of liveSpiders) {
      spider.attackCooldown = Math.max(0, spider.attackCooldown - delta);
      if (spider.attackCooldown > 0) continue;

      // Find the nearest character in range
      let nearestDist = Infinity;
      let target: Character | null = null;

      for (const character of characters) {
        if (character.isDead) continue;
        const d = chebyshev(spider.gridX, spider.gridY, character.gridX, character.gridY);
        if (d <= ATTACK_RANGE && d < nearestDist) {
          nearestDist = d;
          target = character;
        }
      }

      if (target) {
        this.hitCharacter(spider.attackPower, target);
        spider.attackCooldown = spider.attackInterval;
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
    }
  }

  private hitSpider(damage: number, spider: EssenceSpider): void {
    spider.health = Math.max(0, spider.health - damage);
    this.flash(spider.sprite, 0xff6600, () => spider.isDead);

    if (spider.health <= 0 && !spider.isDead) {
      spider.isDead = true;
      this.scene.time.delayedCall(HIT_FLASH_MS + 50, () => {
        spider.destroy();
      });
    }
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
    if (!sprite.active) return;
    sprite.setTint(color);

    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (!sprite.active) return;
      if (isDead()) {
        sprite.setTint(0x666666);
      } else {
        sprite.clearTint();
      }
    });
  }
}
