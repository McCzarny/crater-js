import Phaser from 'phaser';
import { CONFIG } from '../config';
import type TerrainSystem from '../systems/TerrainSystem';
import type { ICharacter, IMob } from '../types/game-types';

// ── Tuning constants ────────────────────────────────────────────────────────

/** How far (in tiles, Chebyshev) the spider can sense a character. */
const CHASE_RADIUS = 10;

/**
 * Maximum distance (tiles, Euclidean) the spider may travel from its cocoon
 * while chasing.  It will never step beyond this leash.
 */
const LEASH_RADIUS = 10;

/** Distance from cocoon (tiles) at which the spider considers itself "home". */
const HOME_RADIUS = 2;

/** Milliseconds between tile-steps. Lower = faster spider. */
const MOVE_INTERVAL_MS = 600;

/** Starting and maximum health for the spider. */
export const SPIDER_MAX_HEALTH = 50;

/** Damage the spider deals per hit. */
export const SPIDER_ATTACK_POWER = 12;

/** Milliseconds between spider attacks. */
export const SPIDER_ATTACK_INTERVAL = 1200;

// ────────────────────────────────────────────────────────────────────────────

/**
 * EssenceSpider – the first mob in the game.
 *
 * Behaviour:
 *  - Idle near cocoon when no character is within CHASE_RADIUS tiles.
 *  - Chases the nearest visible character, but is leashed to its cocoon:
 *    it will never step more than LEASH_RADIUS tiles away from it.
 *  - Moves one grid tile at a time, once per MOVE_INTERVAL_MS milliseconds.
 *  - Attack / death / loot logic is left for a future iteration; health is
 *    defined here so the field is ready to be wired up.
 */
export default class EssenceSpider implements IMob {
  scene: Phaser.Scene;

  gridX: number;
  gridY: number;

  /** Fixed position of the cocoon this spider guards. */
  readonly cocoonX: number;
  readonly cocoonY: number;

  health: number;
  readonly maxHealth: number;

  isDead: boolean;
  readonly attackPower: number;
  readonly attackInterval: number;
  attackCooldown: number;

  sprite: Phaser.GameObjects.Image;
  cocoonSprite: Phaser.GameObjects.Image;

  private readonly terrainSystem: TerrainSystem;
  /** Accumulated time since the last step (ms). */
  private moveAccumulator: number = 0;

  constructor(
    scene: Phaser.Scene,
    terrainSystem: TerrainSystem,
    gridX: number,
    gridY: number,
    cocoonX: number,
    cocoonY: number,
  ) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;
    this.gridX = gridX;
    this.gridY = gridY;
    this.cocoonX = cocoonX;
    this.cocoonY = cocoonY;
    this.maxHealth = SPIDER_MAX_HEALTH;
    this.health = SPIDER_MAX_HEALTH;
    this.isDead = false;
    this.attackPower = SPIDER_ATTACK_POWER;
    this.attackInterval = SPIDER_ATTACK_INTERVAL;
    this.attackCooldown = 0;

    const bs = CONFIG.BLOCK_SIZE;

    // Cocoon – placed at the cocoon tile and stays static
    this.cocoonSprite = scene.add
      .image(cocoonX * bs + bs / 2, cocoonY * bs + bs / 2, 'spider_cocoon')
      .setDisplaySize(bs, bs)
      .setDepth(900);

    // Spider itself
    this.sprite = scene.add
      .sprite(gridX * bs + bs / 2, gridY * bs + bs / 2, 'essence_spider_sheet')
      .setDisplaySize(bs, bs)
      .setDepth(950)
      .play({ key: 'spider_idle', repeat: -1, yoyo: true });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Drive the spider AI and move the sprite.
   * Called every frame from GameScene / TerrainSystem.
   */
  update(characters: ICharacter[], _time: number, delta: number): void {
    if (this.isDead) {
      return;
    }

    this.moveAccumulator += delta;
    if (this.moveAccumulator < MOVE_INTERVAL_MS) {
      return;
    }
    this.moveAccumulator -= MOVE_INTERVAL_MS;

    const target = this.findChaseTarget(characters);

    if (target !== null && target.gridX !== null && target.gridY !== null) {
      this.stepToward(target.gridX, target.gridY, /* respectLeash */ true);
    } else {
      // No character to chase – wander back to cocoon if too far away
      const dx = this.gridX - this.cocoonX;
      const dy = this.gridY - this.cocoonY;
      if (dx * dx + dy * dy > HOME_RADIUS * HOME_RADIUS) {
        this.stepToward(this.cocoonX, this.cocoonY, /* respectLeash */ false);
      }
    }
  }

  destroy(): void {
    this.sprite.destroy();
    this.cocoonSprite.destroy();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Return the nearest living character within CHASE_RADIUS tiles, or null.
   */
  private findChaseTarget(characters: ICharacter[]): ICharacter | null {
    const maxSq = CHASE_RADIUS * CHASE_RADIUS;
    let best: ICharacter | null = null;
    let bestDist = Infinity;

    for (const char of characters) {
      if (char.isDead || char.gridX === null || char.gridY === null) {
        continue;
      }
      const d = this.distSq(this.gridX, this.gridY, char.gridX, char.gridY);
      if (d <= maxSq && d < bestDist) {
        bestDist = d;
        best = char;
      }
    }
    return best;
  }

  /**
   * Try to take one step toward (tx, ty).
   * If respectLeash is true the step is only taken when the resulting tile
   * is still within LEASH_RADIUS of the cocoon.
   */
  private stepToward(tx: number, ty: number, respectLeash: boolean): void {
    const ddx = tx - this.gridX;
    const ddy = ty - this.gridY;

    if (ddx === 0 && ddy === 0) {
      return; // Already at target
    }

    // Build candidate moves in descending priority (axis with larger offset first)
    const stepX = Math.sign(ddx) as -1 | 0 | 1;
    const stepY = Math.sign(ddy) as -1 | 0 | 1;

    const candidates: { dx: -1 | 0 | 1; dy: -1 | 0 | 1 }[] =
      Math.abs(ddx) >= Math.abs(ddy)
        ? [
          { dx: stepX, dy: 0 },
          { dx: 0, dy: stepY },
        ]
        : [
          { dx: 0, dy: stepY },
          { dx: stepX, dy: 0 },
        ];

    for (const c of candidates) {
      if (c.dx === 0 && c.dy === 0) {
        continue;
      }
      const nx = this.gridX + c.dx;
      const ny = this.gridY + c.dy;

      if (!this.canMoveTo(nx, ny)) {
        continue;
      }

      if (respectLeash) {
        const leashSq = this.distSq(nx, ny, this.cocoonX, this.cocoonY);
        if (leashSq > LEASH_RADIUS * LEASH_RADIUS) {
          continue; // Would violate leash – skip
        }
      }

      // Commit the move
      this.gridX = nx;
      this.gridY = ny;

      if (c.dx !== 0) {
        this.sprite.setFlipX(c.dx < 0);
      }

      const bs = CONFIG.BLOCK_SIZE;
      this.sprite.setPosition(nx * bs + bs / 2, ny * bs + bs / 2);
      return; // Only one step per tick
    }
  }

  /**
   * Returns true when the spider can occupy the given tile (non-solid, in bounds).
   */
  private canMoveTo(x: number, y: number): boolean {
    if (x < 0 || x >= CONFIG.WORLD_WIDTH || y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return false;
    }
    const tile = this.terrainSystem.getBlockAt(x, y);
    return tile !== null && !tile.solid;
  }

  private distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }
}
