import Phaser from 'phaser';
import { CONFIG } from '../config';
import type TerrainSystem from '../systems/TerrainSystem';
import { TileType } from '../systems/TileTypes';
import type { ICharacter, IMob } from '../types/game-types';

// ── Tuning constants ─────────────────────────────────────────────────────────

/** Starting and maximum health for the worm. */
const WORM_MAX_HEALTH = 80;

/** Damage the worm deals per hit (higher than spider's 12). */
const WORM_ATTACK_POWER = 20;

/** Milliseconds between worm attacks. */
const WORM_ATTACK_INTERVAL = 1000;

/** Milliseconds between tile-steps when moving through already-open space. */
const MOVE_INTERVAL_MS = 400;

/** Milliseconds spent digging through each solid tile (10 seconds). */
const DIG_INTERVAL_MS = 10_000;

/** Min/max number of body segments between head and butt. */
const BODY_SEGMENTS_MIN = 2;
const BODY_SEGMENTS_MAX = 7;

/** Min/max vertical steps taken when reversing direction at a wall. */
const TURN_STEPS_MIN = 1;
const TURN_STEPS_MAX = 3;

// ─────────────────────────────────────────────────────────────────────────────

type WormState = 'dig_right' | 'dig_left' | 'turn_up' | 'turn_down';

/**
 * WormMob – a multi-segment burrowing mob.
 *
 * Structure: [head] [body] [body] [butt]  (4 tiles total)
 *
 * Behaviour:
 *  - Starts digging horizontally to the right.
 *  - When it hits the world edge (or an undiggable tile) it turns vertically
 *    1–3 tiles, then reverses horizontal direction.
 *  - Can dig through all breakable tiles AND boulders.
 *  - Attacks characters adjacent to its head (handled by CombatSystem).
 *
 * Sprite rendering:
 *  - Head uses the animated 'worm_head_str' tag; flipped/rotated per direction.
 *  - Body uses frame '5' (straight) or '6' (turn) with flip/angle.
 *  - Butt uses frame '7', oriented toward the body.
 */
export default class WormMob implements IMob {
  scene: Phaser.Scene;

  /** Head grid position (used by the combat system). */
  gridX: number;
  gridY: number;

  health: number;
  readonly maxHealth: number;

  isDead: boolean;
  readonly attackPower: number;
  readonly attackInterval: number;
  attackCooldown: number;

  /** Head sprite – exposed for combat-system flash effects. */
  sprite: Phaser.GameObjects.Image;

  private readonly terrainSystem: TerrainSystem;

  /** All segment positions; index 0 = head, last = butt. */
  private readonly segments: { x: number; y: number }[];

  /** One display object per segment (index-aligned with segments[]). */
  private readonly segmentSprites: Phaser.GameObjects.Sprite[];

  /** Typed as Sprite so we can call .play() without casting everywhere. */
  private readonly headSprite: Phaser.GameObjects.Sprite;

  private state: WormState;

  /** Remembers the last horizontal direction so we know where to go after a turn. */
  private lastHorizontalDir: 'right' | 'left';

  /** How many vertical steps are still pending in the current turn. */
  private turnStepsRemaining: number;

  private moveAccumulator: number;

  /** Delay before the next advance() call – MOVE_INTERVAL_MS or DIG_INTERVAL_MS. */
  private nextMoveDelay: number;

  constructor(
    scene: Phaser.Scene,
    terrainSystem: TerrainSystem,
    headX: number,
    headY: number,
    giant = false,
  ) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;
    this.gridX = headX;
    this.gridY = headY;
    this.maxHealth = WORM_MAX_HEALTH;
    this.health = WORM_MAX_HEALTH;
    this.isDead = false;
    this.attackPower = WORM_ATTACK_POWER;
    this.attackInterval = WORM_ATTACK_INTERVAL;
    this.attackCooldown = 0;
    const startRight = Math.random() < 0.5;
    this.state = startRight ? 'dig_right' : 'dig_left';
    this.lastHorizontalDir = startRight ? 'right' : 'left';
    this.turnStepsRemaining = 0;
    this.moveAccumulator = 0;
    this.nextMoveDelay = MOVE_INTERVAL_MS;

    let bodySegments =
      BODY_SEGMENTS_MIN + Math.floor(Math.random() * (BODY_SEGMENTS_MAX - BODY_SEGMENTS_MIN + 1));

    if (giant) {
      this.health = this.maxHealth = Math.round(this.maxHealth * 3.0);
      this.nextMoveDelay = Math.round(this.nextMoveDelay * 1.5);
      bodySegments = Math.round(bodySegments * 3.0);
    }

    // Build initial segment positions: body trails behind the head.
    const totalLength = 1 + bodySegments + 1;
    this.segments = [];
    const trailDir = startRight ? -1 : 1; // segments extend opposite to movement
    for (let i = 0; i < totalLength; i++) {
      this.segments.push({ x: headX + trailDir * i, y: headY });
    }

    const bs = CONFIG.BLOCK_SIZE;
    this.segmentSprites = [];

    // Head – animated sprite
    this.headSprite = scene.add
      .sprite(headX * bs + bs / 2, headY * bs + bs / 2, 'worm_sheet')
      .setDisplaySize(bs, bs)
      .setDepth(952)
      .play({ key: 'worm_head_str', repeat: -1 }) as unknown as Phaser.GameObjects.Sprite;
    this.sprite = this.headSprite as unknown as Phaser.GameObjects.Image;
    this.segmentSprites.push(this.headSprite);

    // Body segments – animated sprites
    for (let i = 1; i <= bodySegments; i++) {
      const seg = this.segments[i];
      const bodySprite = scene.add
        .sprite(seg.x * bs + bs / 2, seg.y * bs + bs / 2, 'worm_sheet')
        .setDisplaySize(bs, bs)
        .setDepth(951)
        .play({ key: 'worm_body_str', repeat: -1 });
      this.segmentSprites.push(bodySprite);
    }

    // Butt – animated sprite
    const buttSeg = this.segments[totalLength - 1];
    const buttSprite = scene.add
      .sprite(buttSeg.x * bs + bs / 2, buttSeg.y * bs + bs / 2, 'worm_sheet')
      .setDisplaySize(bs, bs)
      .setDepth(950)
      .play({ key: 'worm_butt_str', repeat: -1 });
    this.segmentSprites.push(buttSprite);

    // Clear the tiles the worm initially occupies
    for (const seg of this.segments) {
      this.digAt(seg.x, seg.y);
    }

    this.updateSprites();
    // Set initial delay based on whether the first dig target is solid
    this.nextMoveDelay = this.computeNextMoveDelay();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  update(_characters: ICharacter[], _time: number, delta: number): void {
    if (this.isDead) {
      return;
    }

    this.moveAccumulator += delta;
    if (this.moveAccumulator < this.nextMoveDelay) {
      return;
    }
    this.moveAccumulator -= this.nextMoveDelay;

    this.advance();
    this.updateSprites();
    // Update delay for next tick based on what lies ahead
    this.nextMoveDelay = this.computeNextMoveDelay();
  }

  destroy(): void {
    for (const s of this.segmentSprites) {
      s.destroy();
    }
  }

  /** Returns all grid positions occupied by the worm (used by CombatSystem). */
  getAttackPositions(): ReadonlyArray<{ x: number; y: number }> {
    return this.segments;
  }

  /**
   * Re-clears all tiles occupied by the worm's segments.
   * Must be called AFTER the worm is registered in TerrainSystem.worms so that
   * the worm is already solid (CREATURE overlay). Any boulder that cascaded
   * onto a segment position during the constructor's initial clearing is removed.
   */
  settle(): void {
    for (const seg of this.segments) {
      this.digAt(seg.x, seg.y);
    }
  }

  /** Returns true if the given grid tile is occupied by any segment of this worm. */
  occupiesAt(gridX: number, gridY: number): boolean {
    for (const seg of this.segments) {
      if (seg.x === gridX && seg.y === gridY) {
        return true;
      }
    }
    return false;
  }

  // ── Private: movement ──────────────────────────────────────────────────────

  private advance(): void {
    let dx = 0;
    let dy = 0;
    switch (this.state) {
      case 'dig_right':
        dx = 1;
        break;
      case 'dig_left':
        dx = -1;
        break;
      case 'turn_up':
        dy = -1;
        break;
      case 'turn_down':
        dy = 1;
        break;
    }

    const nx = this.segments[0].x + dx;
    const ny = this.segments[0].y + dy;

    if (!this.canMoveTo(nx, ny)) {
      this.handleBlocked();
      return;
    }

    // Shift segments BEFORE digging so that `isOccupiedByCreature(nx, ny)` returns true
    // while mineBlockAt fires the boulder reaction. This prevents boulders from falling
    // through the tile the worm is about to occupy.
    const last = this.segments.length - 1;
    const vacatedX = this.segments[last].x;
    const vacatedY = this.segments[last].y;

    for (let i = this.segments.length - 1; i > 0; i--) {
      this.segments[i].x = this.segments[i - 1].x;
      this.segments[i].y = this.segments[i - 1].y;
    }
    this.segments[0].x = nx;
    this.segments[0].y = ny;
    this.gridX = nx;
    this.gridY = ny;

    // Dig the tile now that the worm occupies it (digAt bypasses the CREATURE overlay
    // and reads blocks[][] directly, so it can still clear the terrain).
    this.digAt(nx, ny);

    // Trigger boulder reactions for the vacated tail tile
    this.terrainSystem.handleEnvironmentAfterChange(vacatedX, vacatedY);

    // Handle turn-step countdown
    if (this.state === 'turn_up' || this.state === 'turn_down') {
      this.turnStepsRemaining--;
      if (this.turnStepsRemaining <= 0) {
        // Start horizontal dig in the opposite direction
        this.state = this.lastHorizontalDir === 'right' ? 'dig_left' : 'dig_right';
      }
    }
  }

  private handleBlocked(): void {
    if (this.state === 'dig_right' || this.state === 'dig_left') {
      // Save current horizontal direction, then start a vertical turn
      this.lastHorizontalDir = this.state === 'dig_right' ? 'right' : 'left';
      const steps =
        TURN_STEPS_MIN + Math.floor(Math.random() * (TURN_STEPS_MAX - TURN_STEPS_MIN + 1));
      this.turnStepsRemaining = steps;

      // Prefer a random turn direction; fall back to the other if blocked
      const preferUp = Math.random() < 0.5;
      const hx = this.segments[0].x;
      const hy = this.segments[0].y;
      if (preferUp && this.canMoveTo(hx, hy - 1)) {
        this.state = 'turn_up';
      } else if (this.canMoveTo(hx, hy + 1)) {
        this.state = 'turn_down';
      } else if (this.canMoveTo(hx, hy - 1)) {
        this.state = 'turn_up';
      }
      // else: fully boxed in – worm stays put until next tick tries again
    } else {
      // Vertical turn blocked – switch to horizontal immediately
      this.state = this.lastHorizontalDir === 'right' ? 'dig_left' : 'dig_right';
    }
  }

  /**
   * Returns true when the worm can enter (or dig into) the given tile.
   * The worm passes through non-solid tiles freely and digs breakable
   * tiles or boulders.  It cannot cross the surface layer or world bounds.
   */
  private canMoveTo(x: number, y: number): boolean {
    if (
      x < 0 ||
      x >= CONFIG.WORLD_WIDTH ||
      y <= CONFIG.SURFACE_HEIGHT ||
      y >= CONFIG.WORLD_HEIGHT
    ) {
      return false;
    }
    const block = this.terrainSystem.getBlockAt(x, y);
    if (!block) {
      return false;
    }
    if (!block.solid) {
      return true;
    }
    return block.breakable || block.type === TileType.BOULDER;
  }

  /**
   * Returns how long (ms) to wait before the next advance().
   * Digging through a solid tile takes DIG_INTERVAL_MS; open movement is fast.
   */
  private computeNextMoveDelay(): number {
    let dx = 0;
    let dy = 0;
    switch (this.state) {
      case 'dig_right':
        dx = 1;
        break;
      case 'dig_left':
        dx = -1;
        break;
      case 'turn_up':
        dy = -1;
        break;
      case 'turn_down':
        dy = 1;
        break;
    }
    const nx = this.segments[0].x + dx;
    const ny = this.segments[0].y + dy;
    const block = this.terrainSystem.getBlockAt(nx, ny);
    if (block !== null && block.solid && this.canMoveTo(nx, ny)) {
      return DIG_INTERVAL_MS;
    }
    return MOVE_INTERVAL_MS;
  }

  /**
   * Remove (dig) the tile at (x, y) if it is solid.
   * Handles both normal breakable tiles and indestructible boulders.
   */
  private digAt(x: number, y: number): void {
    // Read the raw terrain block (bypasses CREATURE overlay) so digging works
    // even after the worm has already shifted its head to (x, y).
    const block = this.terrainSystem.blocks[y]?.[x];
    if (!block || !block.solid) {
      return;
    }

    if (block.breakable) {
      this.terrainSystem.mineBlockAt(x, y);
    } else if (block.type === TileType.BOULDER) {
      // Replace with the appropriate mined tile for this depth so the tunnel
      // looks like dug-out rock rather than empty air.
      this.terrainSystem.blocks[y][x] = block.getMinedTile();
      this.terrainSystem.renderBlock(x, y);
      this.terrainSystem.handleEnvironmentAfterChange(x, y);
    }
  }

  // ── Private: sprite orientation ────────────────────────────────────────────

  private updateSprites(): void {
    const bs = CONFIG.BLOCK_SIZE;
    const last = this.segments.length - 1;

    for (let i = 0; i <= last; i++) {
      const seg = this.segments[i];
      const sprite = this.segmentSprites[i];
      sprite.setPosition(seg.x * bs + bs / 2, seg.y * bs + bs / 2);

      if (i === 0) {
        this.applyHeadOrientation(this.headSprite, i);
      } else if (i === last) {
        this.applyButtOrientation(sprite, i);
      } else {
        this.applyBodyOrientation(sprite, i);
      }
    }
  }

  /** Unit vector from segment[i] toward segment[i-1] (head side). */
  private dirToHead(i: number): { dx: number; dy: number } {
    return {
      dx: this.segments[i - 1].x - this.segments[i].x,
      dy: this.segments[i - 1].y - this.segments[i].y,
    };
  }

  /** Unit vector from segment[i] toward segment[i+1] (tail side). */
  private dirToTail(i: number): { dx: number; dy: number } {
    return {
      dx: this.segments[i + 1].x - this.segments[i].x,
      dy: this.segments[i + 1].y - this.segments[i].y,
    };
  }

  /**
   * Orient the head sprite.
   *
   * Natural 'worm_head_str' state: mouth faces right.
   * Natural 'worm_head_turn' state: mouth faces right, body connects from below.
   *
   * In the snake-movement model the head segment is always straight, but we
   * keep the turn-sprite logic as a fallback for any edge case.
   */
  private applyHeadOrientation(sprite: Phaser.GameObjects.Sprite, i: number): void {
    const tail = this.dirToTail(i); // direction from head toward body
    // The head faces AWAY from the body
    const headDx = -tail.dx;
    const headDy = -tail.dy;

    // Reset transforms before applying new ones
    sprite.setAngle(0);
    sprite.setFlipX(false);
    sprite.setFlipY(false);

    // Is the head at a corner? (head axis ≠ body axis)
    const isTurn = (headDx !== 0 && tail.dy !== 0) || (headDy !== 0 && tail.dx !== 0);

    if (isTurn) {
      // worm_head_turn – natural: head right, body below (tail.dy=1)
      if (this.headSprite.anims.currentAnim?.key !== 'worm_head_turn') {
        sprite.play({ key: 'worm_head_turn', repeat: -1 });
      }
      if (headDx < 0) {
        sprite.setFlipX(true);
      } // head faces left
      if (tail.dy < 0) {
        sprite.setFlipY(true);
      } // body is above
    } else {
      // worm_head_str – natural: head faces right
      if (this.headSprite.anims.currentAnim?.key !== 'worm_head_str') {
        sprite.play({ key: 'worm_head_str', repeat: -1 });
      }
      if (headDx < 0) {
        sprite.setFlipX(true);
      } // left
      if (headDy > 0) {
        sprite.setAngle(90);
      } // down
      if (headDy < 0) {
        sprite.setAngle(-90);
      } // up
    }
  }

  /**
   * Orient a body segment.
   *
   * Frame '5' (worm_body_str)  – straight segment; RIGHT end connects toward head.
   * Frame '6' (worm_body_turn) – L-shaped corner; RIGHT arm connects toward head,
   *                               DOWN arm connects toward tail (natural state).
   *
   * Transforms are derived so that, after flipX/flipY then rotation, the texture's
   * right side (1,0) always points in head.dx/head.dy direction.
   */
  private applyBodyOrientation(sprite: Phaser.GameObjects.Sprite, i: number): void {
    const head = this.dirToHead(i);
    const tail = this.dirToTail(i);

    sprite.setAngle(0);
    sprite.setFlipX(false);
    sprite.setFlipY(false);

    const isHoriz = head.dx !== 0 && tail.dx !== 0;
    const isVert = head.dy !== 0 && tail.dy !== 0;

    if (isHoriz || isVert) {
      // ── Straight segment ──────────────────────────────────────────────────
      if (sprite.anims.currentAnim?.key !== 'worm_body_str') {
        sprite.play({ key: 'worm_body_str', repeat: -1 });
      }
      if (isHoriz) {
        // Right end of sprite → head direction
        if (head.dx === -1) {
          sprite.setFlipX(true);
        } // head to left
      } else {
        // Vertical: rotate so the right end points toward head
        if (head.dy === 1) {
          sprite.setAngle(90);
        } // head below
        else {
          sprite.setAngle(-90);
        } // head above
      }
    } else {
      // ── Turn segment ──────────────────────────────────────────────────────
      // Natural: right arm (1,0) → head, down arm (0,1) → tail.
      // Phaser applies transforms in order: flipX → flipY → rotation.
      // Lookup table derived by solving transform(1,0)=head, transform(0,1)=tail.
      if (sprite.anims.currentAnim?.key !== 'worm_body_turn') {
        sprite.play({ key: 'worm_body_turn', repeat: -1 });
      }
      if (head.dx === 1 && tail.dy === 1) {
        /* natural */
      } else if (head.dx === 1 && tail.dy === -1) {
        sprite.setFlipY(true);
      } else if (head.dx === -1 && tail.dy === 1) {
        sprite.setFlipX(true);
      } else if (head.dx === -1 && tail.dy === -1) {
        sprite.setFlipX(true);
        sprite.setFlipY(true);
      } else if (head.dy === 1 && tail.dx === 1) {
        sprite.setFlipY(true);
        sprite.setAngle(90);
      } else if (head.dy === 1 && tail.dx === -1) {
        sprite.setAngle(90);
      } else if (head.dy === -1 && tail.dx === 1) {
        sprite.setAngle(-90);
      } else if (head.dy === -1 && tail.dx === -1) {
        sprite.setFlipX(true);
        sprite.setAngle(90);
      }
    }
  }

  /**
   * Orient the butt segment.
   *
   * Natural 'worm_butt_str': tail-end on the left, body connection on the right.
   */
  private applyButtOrientation(sprite: Phaser.GameObjects.Sprite, i: number): void {
    const head = this.dirToHead(i); // direction toward body

    sprite.setAngle(0);
    sprite.setFlipX(false);
    sprite.setFlipY(false);
    if (sprite.anims.currentAnim?.key !== 'worm_butt_str') {
      sprite.play({ key: 'worm_butt_str', repeat: -1 });
    }
    // Natural: body is to the right (head.dx === 1)
    if (head.dx === -1) {
      sprite.setFlipX(true); // body to the left
    } else if (head.dy === 1) {
      sprite.setAngle(90); // body below: rotate CW so right→down
    } else if (head.dy === -1) {
      sprite.setAngle(-90); // body above: rotate CCW so right→up
    }
  }
}
