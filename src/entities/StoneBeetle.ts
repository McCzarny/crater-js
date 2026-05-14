import Phaser from 'phaser';
import { CONFIG } from '../config';
import type TerrainSystem from '../systems/TerrainSystem';
import type { ICharacter, IMob } from '../types/game-types';

// ── Tuning constants ────────────────────────────────────────────────────────

/** How far (in tiles, Euclidean²) the adult beetle can sense a character. */
const CHASE_RADIUS = 10;

/** Milliseconds between tile-steps in adult mode. */
const MOVE_INTERVAL_MS = 500;

/** Starting and maximum health. */
const BEETLE_MAX_HEALTH = 60;

/** Damage the adult beetle deals per hit. */
const BEETLE_ATTACK_POWER = 25;

/** Milliseconds between adult beetle attacks. */
const BEETLE_ATTACK_INTERVAL = 1000;

// ────────────────────────────────────────────────────────────────────────────

/**
 * StoneBeetle – a mob with two modes:
 *
 * **Larva mode** (default): All 4 cardinal neighbours are solid.
 *   - Renders as the `stone_beetle_larva` frame at its grid position.
 *   - Acts as an indestructible, impassable tile (blocks mining).
 *   - Does not move or attack.
 *
 * **Adult mode**: Triggered when any cardinal neighbour becomes non-solid.
 *   - Mines its own tile and emerges.
 *   - Chases and attacks the nearest character within CHASE_RADIUS tiles.
 */
export default class StoneBeetle implements IMob {
  scene: Phaser.Scene;

  gridX: number;
  gridY: number;

  health: number;
  readonly maxHealth: number;

  isDead: boolean;
  readonly attackPower: number;
  readonly attackInterval: number;
  attackCooldown: number;

  /** Exposed as IMob.sprite for hit-flash effects. */
  sprite: Phaser.GameObjects.Image;

  /** True while embedded in solid rock; false once the beetle has emerged. */
  isLarva: boolean;

  private readonly terrainSystem: TerrainSystem;
  private moveAccumulator: number = 0;
  private currentAnimKey: string = 'stone_beetle_larva';

  constructor(scene: Phaser.Scene, terrainSystem: TerrainSystem, gridX: number, gridY: number) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;
    this.gridX = gridX;
    this.gridY = gridY;
    this.maxHealth = BEETLE_MAX_HEALTH;
    this.health = BEETLE_MAX_HEALTH;
    this.isDead = false;
    this.attackPower = BEETLE_ATTACK_POWER;
    this.attackInterval = BEETLE_ATTACK_INTERVAL;
    this.attackCooldown = 0;
    this.isLarva = true;

    const bs = CONFIG.BLOCK_SIZE;
    this.sprite = scene.add
      .sprite(gridX * bs + bs / 2, gridY * bs + bs / 2, 'stone_beetle_sheet')
      .setDisplaySize(bs, bs)
      .setDepth(950)
      .play({ key: 'stone_beetle_larva', repeat: -1 }) as unknown as Phaser.GameObjects.Image;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Drive the adult beetle AI. Does nothing while in larva mode. */
  update(characters: ICharacter[], _time: number, delta: number): void {
    if (this.isDead || this.isLarva) {
      return;
    }

    this.moveAccumulator += delta;
    if (this.moveAccumulator < MOVE_INTERVAL_MS) {
      return;
    }
    this.moveAccumulator -= MOVE_INTERVAL_MS;

    const target = this.findChaseTarget(characters);
    if (target !== null && target.gridX !== null && target.gridY !== null) {
      this.stepToward(target.gridX, target.gridY);
    }
    this.updateAnimation();
  }

  /**
   * Called by TerrainSystem when a tile adjacent to this beetle changes.
   * If any cardinal neighbour is now open, the beetle transforms to adult.
   */
  checkTransform(): void {
    if (this.isDead || !this.isLarva) {
      return;
    }
    if (this.hasOpenNeighbor()) {
      this.transformToAdult();
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Returns true if any of the 4 cardinal neighbours is not solid. */
  private hasOpenNeighbor(): boolean {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const { dx, dy } of dirs) {
      const block = this.terrainSystem.getBlockAt(this.gridX + dx, this.gridY + dy);
      if (!block || !block.solid) {
        return true;
      }
    }
    return false;
  }

  /**
   * Unset larva mode, mine the occupied tile so the cell becomes walkable,
   * then switch to the adult idle animation.
   */
  private transformToAdult(): void {
    this.isLarva = false;
    // isLarva is now false → mineBlockAt will not be blocked by the larva guard
    this.terrainSystem.mineBlockAt(this.gridX, this.gridY);
    this.updateAnimation();
  }

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

  private stepToward(tx: number, ty: number): void {
    const ddx = tx - this.gridX;
    const ddy = ty - this.gridY;
    if (ddx === 0 && ddy === 0) {
      return;
    }

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
      const block = this.terrainSystem.getBlockAt(nx, ny);
      if (block && !block.solid) {
        this.gridX = nx;
        this.gridY = ny;
        const bs = CONFIG.BLOCK_SIZE;
        this.sprite.setPosition(nx * bs + bs / 2, ny * bs + bs / 2);
        if (c.dx !== 0) {
          this.sprite.setFlipX(c.dx < 0);
        }
        return;
      }
    }
  }

  private distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  private updateAnimation(): void {
    const below = this.terrainSystem.getBlockAt(this.gridX, this.gridY + 1);
    const airborne = !below || !below.solid;
    const key = airborne ? 'stone_beetle_climb' : 'stone_beetle_idle';
    if (key !== this.currentAnimKey) {
      this.currentAnimKey = key;
      (this.sprite as unknown as Phaser.GameObjects.Sprite).play({ key, repeat: -1 });
    }
  }
}
