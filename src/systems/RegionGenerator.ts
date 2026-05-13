import { CONFIG } from '../config';
import { TileType, TileRegistry, type Tile, type TileTypeValue } from './TileTypes';
import type { RegionModifier } from './RegionModifiers';

/**
 * Shared context passed between generation stages.
 * Stages can read/write to communicate data (e.g. cave positions).
 */
interface GenerationContext {
  blocks: Tile[][];
  /** Positions of generated caves (center points) for separation checks */
  cavePositions: { x: number; y: number }[];
  /** Items to spawn after the world is rendered (type + position) */
  pendingItems: { gridX: number; gridY: number; type: string }[];
  /**
   * Spider + cocoon positions to instantiate after the world is rendered.
   * Added by the SpiderSpawn stage.
   */
  pendingSpiders: { spiderX: number; spiderY: number; cocoonX: number; cocoonY: number }[];
  /** Grid positions where ladders should be placed after rendering. Added by the Ruins stage. */
  pendingLadders: { gridX: number; gridY: number }[];
  /** Head positions for Worm mobs to instantiate after the world is rendered. */
  pendingWorms: { x: number; y: number }[];
}

/**
 * A single stage in the world generation pipeline.
 */
interface GenerationStage {
  name: string;
  apply(ctx: GenerationContext): void;
}

// ---------------------------------------------------------------------------
// Numeric Region Modifiers
// ---------------------------------------------------------------------------

export interface NumericModifiers {
  /** World grid width in tiles. */
  worldWidth: number;
  /** World grid height in tiles. */
  worldHeight: number;
  /** Number of cave placement attempts. */
  caveAttempts: number;
  /** Multiplier applied to per-layer boulder spawn chances (1 = default). */
  boulderMultiplier: number;
  /** Multiplier applied to cave loot spawn chance (1 = default). */
  resourceMultiplier: number;
  /** Target number of Essence Spider dens. */
  spiderCount: number;
  /** Target number of Worm mobs. */
  wormCount: number;
  /** Number of extra surface openings (in addition to the starting hole). */
  surfaceOpenings: number;
}

/**
 * Returns a randomly generated set of numeric region modifiers.
 * Call once per level start to vary the generated region.
 */
export function randomizeModifiers(): NumericModifiers {
  const worldWidth = 50 + Math.floor(Math.random() * 36); // 50–85
  const worldHeight = 120 + Math.floor(Math.random() * 81); // 120–200
  const worldSizeFactor = (worldWidth * worldHeight) / (50 * 150); // relative to default size
  const maxOpenings = Math.max(1, Math.floor(worldWidth / 10));
  return {
    worldWidth,
    worldHeight,
    caveAttempts: Math.floor((30 + Math.floor(Math.random() * 61)) * worldSizeFactor), // 30–90
    boulderMultiplier: Math.random() * 2.0, // 0.0–2.0
    resourceMultiplier: 0.5 + Math.random() * 1.5, // 0.5–2.0
    spiderCount: Math.floor((3 + Math.floor(Math.random() * 8)) * worldSizeFactor), // 3–10
    wormCount: 1 + Math.floor(Math.random() * 3), // 1–3
    surfaceOpenings: 1 + Math.floor(Math.random() * maxOpenings), // 1–maxOpenings
  };
}

// ---------------------------------------------------------------------------
// Stage 1: Base Terrain
// ---------------------------------------------------------------------------

/**
 * Generate a single block based on position (layer rules).
 */
function generateBlock(x: number, y: number): Tile {
  // Sky/air blocks
  if (y < CONFIG.SURFACE_HEIGHT) {
    return TileRegistry.createTile(TileType.AIR);
  }

  // Surface layer
  if (y === CONFIG.SURFACE_HEIGHT) {
    return TileRegistry.createTile(TileType.SURFACE);
  }

  // Underground layers
  const depth = y - CONFIG.SURFACE_HEIGHT;
  let tileType: TileTypeValue = TileType.STONE;
  let layerTileType: TileTypeValue = TileType.STONE;

  if (depth <= 3) {
    tileType = TileType.DIRT;
    layerTileType = TileType.DIRT;
  } else if (depth <= CONFIG.LAYERS.DIRT.end) {
    tileType = TileType.DIRT;
    layerTileType = TileType.DIRT;
  } else if (depth <= CONFIG.LAYERS.STONE.end) {
    tileType = TileType.STONE;
    layerTileType = TileType.STONE;
  } else if (depth <= CONFIG.LAYERS.IRON.end) {
    tileType = TileType.IRON_STONE;
    layerTileType = TileType.IRON_STONE;
  } else if (depth <= CONFIG.LAYERS.DEEP_STONE.end) {
    tileType = TileType.DEEP_STONE;
    layerTileType = TileType.DEEP_STONE;
  } else {
    tileType = TileType.RARE_ORE;
    layerTileType = TileType.RARE_ORE;
  }

  const tile = TileRegistry.createTile(tileType);
  tile.minedType = TileRegistry.createTile(layerTileType).minedType;
  return tile;
}

const BaseTerrainStage: GenerationStage = {
  name: 'BaseTerrain',
  apply(ctx: GenerationContext): void {
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
      ctx.blocks[y] = [];
      for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
        ctx.blocks[y][x] = generateBlock(x, y);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Stage 2: Slopes — impassable crater walls at the left and right edges
// ---------------------------------------------------------------------------

/**
 * Width (in columns) of the slope on each side of the world.
 * Characters can only auto-step 1 tile up, so a steepness of 2 tiles per
 * column makes the slope impossible to climb from the playable area inward.
 */
const SLOPE_WIDTH = 8;
/** Tiles of rise per column (must be > 1 to prevent auto-step-up). */
const SLOPE_STEEPNESS = 2;

const SlopesStage: GenerationStage = {
  name: 'Slopes',
  apply(ctx: GenerationContext): void {
    for (let x = 0; x < SLOPE_WIDTH; x++) {
      // Left side: slope top rises as x approaches 0
      const leftTop = Math.max(0, CONFIG.SURFACE_HEIGHT - (SLOPE_WIDTH - x) * SLOPE_STEEPNESS);
      for (let y = leftTop; y < CONFIG.SURFACE_HEIGHT; y++) {
        ctx.blocks[y][x] = TileRegistry.createTile(TileType.SURFACE);
      }

      // Right side: mirror of the left slope
      const rightX = CONFIG.WORLD_WIDTH - 1 - x;
      const rightTop = Math.max(0, CONFIG.SURFACE_HEIGHT - (SLOPE_WIDTH - x) * SLOPE_STEEPNESS);
      for (let y = rightTop; y < CONFIG.SURFACE_HEIGHT; y++) {
        ctx.blocks[y][rightX] = TileRegistry.createTile(TileType.SURFACE);
      }
    }

    console.log(
      `SlopesStage: placed ${SLOPE_WIDTH}-column slopes on both sides ` +
        `(steepness ${SLOPE_STEEPNESS}, unclimbable)`,
    );
  },
};

// ---------------------------------------------------------------------------
// Stage 3: Caves
// ---------------------------------------------------------------------------

/** Configuration for cave generation */
interface CaveConfig {
  /** Minimum distance between cave centres (in tiles) */
  minSeparation: number;
  /** Number of cave placement attempts */
  attempts: number;
  /** Min / max tiles carved per cave */
  minSize: number;
  maxSize: number;
  /** How many tiles below surface before caves can appear */
  minDepthBelowSurface: number;
  /** Probability of spawning a resource in a carved tile (floor) */
  lootChance: number;
}

const CAVE_DEFAULTS: CaveConfig = {
  minSeparation: 15,
  attempts: 60,
  minSize: 4,
  maxSize: 12,
  minDepthBelowSurface: 8,
  lootChance: 0.25,
};

/**
 * Get the mined variant for a tile type (what a carved tile should become).
 */
function minedVariant(tileType: TileTypeValue): TileTypeValue {
  const tile = TileRegistry.getTile(tileType);
  return tile.minedType ?? TileType.MINED_DIRT;
}

/**
 * Returns the resource pool available at a given depth (same logic as ItemManager.tryDropItem).
 */
function resourcePoolForDepth(depth: number): { type: string; weight: number }[] {
  const pool: { type: string; weight: number }[] = [];

  if (depth <= CONFIG.LAYERS.DIRT.end) {
    pool.push({ type: 'COAL', weight: 3 });
  } else if (depth <= CONFIG.LAYERS.STONE.end) {
    pool.push({ type: 'COAL', weight: 3 }, { type: 'EMERALD', weight: 1 });
  } else if (depth <= CONFIG.LAYERS.IRON.end) {
    pool.push({ type: 'EMERALD', weight: 3 }, { type: 'AMETHYST', weight: 1 });
  } else if (depth <= CONFIG.LAYERS.DEEP_STONE.end) {
    pool.push(
      { type: 'EMERALD', weight: 2 },
      { type: 'AMETHYST', weight: 2 },
      { type: 'DIAMOND', weight: 1 },
    );
  } else {
    pool.push(
      { type: 'AMETHYST', weight: 2 },
      { type: 'DIAMOND', weight: 2 },
      { type: 'EMERALD', weight: 1 },
    );
  }
  return pool;
}

function pickWeighted(pool: { type: string; weight: number }[]): string {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) {
      return entry.type;
    }
  }
  return pool[pool.length - 1].type;
}

/**
 * Check whether a candidate position is far enough from all existing caves.
 */
function isFarEnough(
  cx: number,
  cy: number,
  existing: { x: number; y: number }[],
  minSep: number,
): boolean {
  const minSepSq = minSep * minSep;
  for (const pos of existing) {
    const dx = cx - pos.x;
    const dy = cy - pos.y;
    if (dx * dx + dy * dy < minSepSq) {
      return false;
    }
  }
  return true;
}

/**
 * Carve an irregular cave blob using a random-walk / flood approach.
 * Returns the set of tiles that were carved.
 */
function carveCave(
  ctx: GenerationContext,
  cx: number,
  cy: number,
  size: number,
): { x: number; y: number }[] {
  const carved: { x: number; y: number }[] = [];
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [{ x: cx, y: cy }];

  while (carved.length < size && queue.length > 0) {
    // Pick a random element from the queue (gives organic shape)
    const idx = Math.floor(Math.random() * queue.length);
    const pos = queue.splice(idx, 1)[0];
    const key = `${pos.x},${pos.y}`;

    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    // Bounds & validity
    if (
      pos.x < 1 ||
      pos.x >= CONFIG.WORLD_WIDTH - 1 ||
      pos.y < CONFIG.SURFACE_HEIGHT + 2 ||
      pos.y >= CONFIG.WORLD_HEIGHT - 1
    ) {
      continue;
    }

    const tile = ctx.blocks[pos.y][pos.x];
    if (!tile.solid || !tile.breakable) {
      continue;
    }

    // Carve: replace with the mined variant of the original tile
    ctx.blocks[pos.y][pos.x] = TileRegistry.createTile(minedVariant(tile.type));
    carved.push(pos);

    // Add neighbors
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (const d of dirs) {
      const nk = `${pos.x + d.x},${pos.y + d.y}`;
      if (!visited.has(nk)) {
        queue.push({ x: pos.x + d.x, y: pos.y + d.y });
      }
    }
  }

  return carved;
}

function createCaveStage(cfg: Partial<CaveConfig> = {}): GenerationStage {
  const c: CaveConfig = { ...CAVE_DEFAULTS, ...cfg };

  return {
    name: 'Caves',
    apply(ctx: GenerationContext): void {
      const minY = CONFIG.SURFACE_HEIGHT + c.minDepthBelowSurface;
      const maxY = CONFIG.WORLD_HEIGHT - 2;
      let placed = 0;

      for (let attempt = 0; attempt < c.attempts; attempt++) {
        const cx = 2 + Math.floor(Math.random() * (CONFIG.WORLD_WIDTH - 4));
        const cy = minY + Math.floor(Math.random() * (maxY - minY));

        if (!isFarEnough(cx, cy, ctx.cavePositions, c.minSeparation)) {
          continue;
        }

        const size = c.minSize + Math.floor(Math.random() * (c.maxSize - c.minSize + 1));
        const carved = carveCave(ctx, cx, cy, size);

        if (carved.length < c.minSize) {
          continue; // failed to carve enough, skip
        }

        ctx.cavePositions.push({ x: cx, y: cy });
        placed++;

        // Find floor tiles (carved tiles that have a solid tile below)
        const depth = cy - CONFIG.SURFACE_HEIGHT;
        const pool = resourcePoolForDepth(depth);

        for (const pos of carved) {
          const belowY = pos.y + 1;
          if (
            belowY < CONFIG.WORLD_HEIGHT &&
            ctx.blocks[belowY][pos.x].solid &&
            Math.random() < c.lootChance
          ) {
            ctx.pendingItems.push({
              gridX: pos.x,
              gridY: pos.y,
              type: pickWeighted(pool),
            });
          }
        }
      }

      console.log(`CaveStage: placed ${placed} caves`);
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 3: Boulders
// ---------------------------------------------------------------------------

/** Boulder chance per layer (depth from surface) */
const BOULDER_CHANCES: { endDepth: number; chance: number }[] = [
  { endDepth: 3, chance: 0 },
  { endDepth: CONFIG.LAYERS.DIRT.end, chance: 0.05 },
  { endDepth: CONFIG.LAYERS.STONE.end, chance: 0.1 },
  { endDepth: CONFIG.LAYERS.IRON.end, chance: 0.15 },
  { endDepth: CONFIG.LAYERS.DEEP_STONE.end, chance: 0.2 },
  { endDepth: Infinity, chance: 0.25 },
];

function getBoulderChance(depth: number): number {
  for (const entry of BOULDER_CHANCES) {
    if (depth <= entry.endDepth) {
      return entry.chance;
    }
  }
  return 0;
}

function createBoulderStage(multiplier: number = 1): GenerationStage {
  return {
    name: 'Boulders',
    apply(ctx: GenerationContext): void {
      let placed = 0;

      for (let y = CONFIG.SURFACE_HEIGHT + 1; y < CONFIG.WORLD_HEIGHT - 1; y++) {
        const depth = y - CONFIG.SURFACE_HEIGHT;
        const chance = getBoulderChance(depth) * multiplier;
        if (chance <= 0) {
          continue;
        }

        for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
          const tile = ctx.blocks[y][x];
          const tileBelow = ctx.blocks[y + 1][x];

          // Boulder can only replace a solid tile with a solid tile below
          if (!tile.solid || !tileBelow.solid) {
            continue;
          }

          if (Math.random() < chance) {
            const boulder = TileRegistry.createTile(TileType.BOULDER);
            boulder.minedType = tile.minedType;
            ctx.blocks[y][x] = boulder;
            placed++;
          }
        }
      }

      console.log(`BoulderStage: placed ${placed} boulders`);
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 4: Surface Features (starting hole)
// ---------------------------------------------------------------------------

const SurfaceFeaturesStage: GenerationStage = {
  name: 'SurfaceFeatures',
  apply(ctx: GenerationContext): void {
    const centerX = Math.floor(CONFIG.WORLD_WIDTH / 2);
    const surfaceY = CONFIG.SURFACE_HEIGHT;

    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      if (x >= 0 && x < CONFIG.WORLD_WIDTH) {
        ctx.blocks[surfaceY][x] = TileRegistry.createTile(TileType.MINED_DIRT);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Stage 4b: Surface Openings — additional shafts from surface to underground
// ---------------------------------------------------------------------------

/** Number of extra openings to carve (in addition to the center starting hole). */
const SURFACE_OPENING_COUNT = 4;
/** Depth in tiles below the surface tile each shaft extends. */
const SURFACE_OPENING_MIN_DEPTH = 1;
const SURFACE_OPENING_MAX_DEPTH = 2;
/** Minimum horizontal distance between any two openings (and from slopes). */
const SURFACE_OPENING_MIN_SEP = 5;

function createSurfaceOpeningsStage(count: number): GenerationStage {
  return {
    name: 'SurfaceOpenings',
    apply(ctx: GenerationContext): void {
      const centerX = Math.floor(CONFIG.WORLD_WIDTH / 2);
      const surfaceY = CONFIG.SURFACE_HEIGHT;

      // Stay inside the playable area (clear of slopes and world edges)
      const playableLeft = SLOPE_WIDTH + 2;
      const playableRight = CONFIG.WORLD_WIDTH - SLOPE_WIDTH - 2;

      // Track placed X positions; seed with the center hole so openings keep clear of it
      const placedX: number[] = [centerX - 1, centerX, centerX + 1];
      let placed = 0;

      for (let attempt = 0; attempt < 200 && placed < count; attempt++) {
        const x = playableLeft + Math.floor(Math.random() * (playableRight - playableLeft + 1));

        if (placedX.some(px => Math.abs(px - x) < SURFACE_OPENING_MIN_SEP)) {
          continue;
        }

        const depth =
          SURFACE_OPENING_MIN_DEPTH +
          Math.floor(Math.random() * (SURFACE_OPENING_MAX_DEPTH - SURFACE_OPENING_MIN_DEPTH + 1));

        // Carve the surface tile
        ctx.blocks[surfaceY][x] = TileRegistry.createTile(TileType.MINED_DIRT);

        // Carve underground tiles below the surface
        for (let dy = 1; dy <= depth; dy++) {
          const y = surfaceY + dy;
          if (y < CONFIG.WORLD_HEIGHT) {
            const tile = ctx.blocks[y][x];
            if (tile.solid && tile.breakable) {
              ctx.blocks[y][x] = TileRegistry.createTile(minedVariant(tile.type));
            }
          }
        }

        placedX.push(x);
        placed++;
      }

      console.log(`SurfaceOpeningsStage: placed ${placed} additional openings`);
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 5: Essence Spider dens
// ---------------------------------------------------------------------------

/**
 * How many spider dens the stage will attempt to place.
 * Each den carves a larger-than-normal cave and contains one spider + cocoon.
 */
const SPIDER_COUNT_TARGET = 6;
/** Den caves are bigger than regular caves to give spiders room to patrol. */
const SPIDER_DEN_MIN_SIZE = 14;
const SPIDER_DEN_MAX_SIZE = 22;
/**
 * Minimum Euclidean tile distance between any two spider dens.
 * Keeps them spread across the world.
 */
const SPIDER_DEN_MIN_SEPARATION = 30;
/**
 * Spider dens only appear at or below the stone layer so they feel deep
 * and threatening.
 */
const SPIDER_DEN_MIN_DEPTH_BELOW_SURFACE = CONFIG.LAYERS.STONE.start; // 15

function createSpiderSpawnStage(count: number): GenerationStage {
  return {
    name: 'SpiderSpawn',
    apply(ctx: GenerationContext): void {
      /** Tracks placed den centres for the separation constraint. */
      const denPositions: { x: number; y: number }[] = [];

      const minY = CONFIG.SURFACE_HEIGHT + SPIDER_DEN_MIN_DEPTH_BELOW_SURFACE;
      const maxY = CONFIG.WORLD_HEIGHT - 5;

      for (let attempt = 0; attempt < 200 && denPositions.length < count; attempt++) {
        const cx = 3 + Math.floor(Math.random() * (CONFIG.WORLD_WIDTH - 6));
        const cy = minY + Math.floor(Math.random() * (maxY - minY));

        // Keep dens away from each other
        if (!isFarEnough(cx, cy, denPositions, SPIDER_DEN_MIN_SEPARATION)) {
          continue;
        }
        // Keep dens slightly separated from regular cave centres too (avoids
        // overlapping with player-accessible caves right at the entrance)
        if (!isFarEnough(cx, cy, ctx.cavePositions, 8)) {
          continue;
        }

        const size =
          SPIDER_DEN_MIN_SIZE +
          Math.floor(Math.random() * (SPIDER_DEN_MAX_SIZE - SPIDER_DEN_MIN_SIZE + 1));
        const carved = carveCave(ctx, cx, cy, size);

        // A den needs enough space for both spider and cocoon
        if (carved.length < SPIDER_DEN_MIN_SIZE) {
          continue;
        }

        // Collect floor tiles: carved tiles that have a solid tile directly below
        const floorTiles = carved.filter(p => {
          const below = ctx.blocks[p.y + 1]?.[p.x];
          return below !== undefined && below.solid;
        });

        if (floorTiles.length < 2) {
          continue; // Need at least two floor positions for cocoon + spider
        }

        // Place cocoon at the middle floor tile (most central feel)
        const midIdx = Math.floor(floorTiles.length / 2);
        const cocoonPos = floorTiles[midIdx];

        // Place spider on a different floor tile, preferably adjacent
        const spiderPos =
          floorTiles.find(
            p =>
              (p.x !== cocoonPos.x || p.y !== cocoonPos.y) &&
              Math.abs(p.x - cocoonPos.x) <= 3 &&
              Math.abs(p.y - cocoonPos.y) <= 1,
          ) ??
          floorTiles.find(p => p.x !== cocoonPos.x || p.y !== cocoonPos.y) ??
          floorTiles[0];

        denPositions.push({ x: cx, y: cy });
        ctx.cavePositions.push({ x: cx, y: cy }); // Register as a cave too

        ctx.pendingSpiders.push({
          spiderX: spiderPos.x,
          spiderY: spiderPos.y,
          cocoonX: cocoonPos.x,
          cocoonY: cocoonPos.y,
        });
      }

      console.log(`SpiderSpawnStage: placed ${denPositions.length} spider dens`);
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 6b: Worm Spawn — places burrowing worm mobs underground
// ---------------------------------------------------------------------------

/**
 * Minimum separation between worm spawn points (tiles, Euclidean).
 */
const WORM_MIN_SEPARATION = 15;

function createWormSpawnStage(count: number): GenerationStage {
  return {
    name: 'WormSpawn',
    apply(ctx: GenerationContext): void {
      const minY = CONFIG.SURFACE_HEIGHT + 10;
      const maxY = CONFIG.WORLD_HEIGHT - 10;
      const minX = SLOPE_WIDTH + 5;
      const maxX = CONFIG.WORLD_WIDTH - SLOPE_WIDTH - 5;

      const positions: { x: number; y: number }[] = [];

      for (let attempt = 0; attempt < 150 && positions.length < count; attempt++) {
        const x = minX + Math.floor(Math.random() * (maxX - minX));
        const y = minY + Math.floor(Math.random() * (maxY - minY));

        if (!isFarEnough(x, y, positions, WORM_MIN_SEPARATION)) {
          continue;
        }

        positions.push({ x, y });
        ctx.pendingWorms.push({ x, y });
      }

      console.log(`WormSpawnStage: placed ${positions.length} worms`);
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 6: Old Camp — surface items left by a previous expedition
// ---------------------------------------------------------------------------

/** Item pool for the old camp: ladders most likely, minerals rare. */
const OLD_CAMP_ITEM_POOL: { type: string; weight: number }[] = [
  { type: 'LADDER', weight: 5 },
  { type: 'COAL', weight: 3 },
  { type: 'EMERALD', weight: 1 },
];

function createOldCampStage(): GenerationStage {
  return {
    name: 'OldCamp',
    apply(ctx: GenerationContext): void {
      const playableLeft = SLOPE_WIDTH + 3;
      const playableRight = CONFIG.WORLD_WIDTH - SLOPE_WIDTH - 3;
      const surfaceY = CONFIG.SURFACE_HEIGHT;

      const campX = playableLeft + Math.floor(Math.random() * (playableRight - playableLeft + 1));
      const campWidth = 2 + Math.floor(Math.random() * 2); // 2–3 tiles wide

      // Scatter items across the cleared area
      const itemCount = 3 + Math.floor(Math.random() * 4); // 3–6 items
      for (let i = 0; i < itemCount; i++) {
        const x = campX + Math.floor(Math.random() * campWidth);
        if (x >= 0 && x < CONFIG.WORLD_WIDTH) {
          ctx.pendingItems.push({
            gridX: x,
            gridY: surfaceY - 1,
            type: pickWeighted(OLD_CAMP_ITEM_POOL),
          });
        }
      }

      console.log(
        `OldCampStage: placed camp at x=${campX}, width=${campWidth}, items=${itemCount}`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 7: Buried Cache — precious minerals hidden in the deepest cave
// ---------------------------------------------------------------------------

/** High-value item pool for the buried cache. */
const BURIED_CACHE_POOL: { type: string; weight: number }[] = [
  { type: 'DIAMOND', weight: 4 },
  { type: 'AMETHYST', weight: 3 },
  { type: 'EMERALD', weight: 2 },
];

function createBuriedCacheStage(): GenerationStage {
  return {
    name: 'BuriedCache',
    apply(ctx: GenerationContext): void {
      if (ctx.cavePositions.length === 0) {
        return;
      }

      // Find the deepest cave as the cache location
      const deepest = ctx.cavePositions.reduce((best, p) => (p.y > best.y ? p : best));

      const itemCount = 5 + Math.floor(Math.random() * 4); // 5–8 items
      let placed = 0;

      // Scan around the deepest cave for valid floor tiles (non-solid with solid support below)
      for (let dy = -8; dy <= 8 && placed < itemCount; dy++) {
        for (let dx = -8; dx <= 8 && placed < itemCount; dx++) {
          const x = deepest.x + dx;
          const y = deepest.y + dy;
          if (
            x < 1 ||
            x >= CONFIG.WORLD_WIDTH - 1 ||
            y < CONFIG.SURFACE_HEIGHT + 1 ||
            y >= CONFIG.WORLD_HEIGHT - 1
          ) {
            continue;
          }
          const tile = ctx.blocks[y]?.[x];
          const tileBelow = ctx.blocks[y + 1]?.[x];
          if (tile && !tile.solid && tileBelow && tileBelow.solid && Math.random() < 0.35) {
            ctx.pendingItems.push({ gridX: x, gridY: y, type: pickWeighted(BURIED_CACHE_POOL) });
            placed++;
          }
        }
      }

      console.log(
        `BuriedCacheStage: placed ${placed} items near deepest cave (${deepest.x}, ${deepest.y})`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 8: Ruins — pre-placed shafts with ladders
// ---------------------------------------------------------------------------

const RUINS_SHAFT_COUNT = 4;
const RUINS_SHAFT_MIN_DEPTH_BELOW_SURFACE = 3;
const RUINS_SHAFT_MIN_LENGTH = 5;
const RUINS_SHAFT_MAX_LENGTH = 14;
/** Minimum tiles between tunnel branch origins along a shaft. */
const RUINS_TUNNEL_SPACING = 3;
const RUINS_TUNNEL_MIN_LENGTH = 3;
const RUINS_TUNNEL_MAX_LENGTH = 8;

/** Carve a horizontal tunnel from (x, y) in the given direction for `length` tiles. */
function carveHorizontalTunnel(
  ctx: GenerationContext,
  x: number,
  y: number,
  direction: -1 | 1,
  length: number,
): void {
  for (let dx = 1; dx <= length; dx++) {
    const tx = x + dx * direction;
    if (tx < 1 || tx >= CONFIG.WORLD_WIDTH - 1) {
      break;
    }
    const tile = ctx.blocks[y][tx];
    if (tile && tile.solid && tile.breakable) {
      ctx.blocks[y][tx] = TileRegistry.createTile(minedVariant(tile.type));
    }
  }
}

function createRuinsStage(): GenerationStage {
  return {
    name: 'Ruins',
    apply(ctx: GenerationContext): void {
      const playableLeft = SLOPE_WIDTH + 3;
      const playableRight = CONFIG.WORLD_WIDTH - SLOPE_WIDTH - 3;
      const placedX: number[] = [];
      let placed = 0;

      for (let attempt = 0; attempt < 100 && placed < RUINS_SHAFT_COUNT; attempt++) {
        const x = playableLeft + Math.floor(Math.random() * (playableRight - playableLeft + 1));
        if (placedX.some(px => Math.abs(px - x) < 2)) {
          continue;
        }
        const startY =
          CONFIG.SURFACE_HEIGHT +
          RUINS_SHAFT_MIN_DEPTH_BELOW_SURFACE +
          Math.floor(Math.random() * 10);
        const length =
          RUINS_SHAFT_MIN_LENGTH +
          Math.floor(Math.random() * (RUINS_SHAFT_MAX_LENGTH - RUINS_SHAFT_MIN_LENGTH + 1));

        let lastTunnelDy = -RUINS_TUNNEL_SPACING; // allow a tunnel at the very start

        for (let dy = 0; dy < length; dy++) {
          const y = startY + dy;
          if (y >= CONFIG.WORLD_HEIGHT - 1) {
            break;
          }

          // Carve shaft tile
          const tile = ctx.blocks[y][x];
          if (tile.solid && tile.breakable) {
            ctx.blocks[y][x] = TileRegistry.createTile(minedVariant(tile.type));
          }
          ctx.pendingLadders.push({ gridX: x, gridY: y });

          // Maybe branch a horizontal tunnel at this depth
          if (dy - lastTunnelDy >= RUINS_TUNNEL_SPACING && Math.random() < 0.4) {
            lastTunnelDy = dy;
            const tunnelLength =
              RUINS_TUNNEL_MIN_LENGTH +
              Math.floor(Math.random() * (RUINS_TUNNEL_MAX_LENGTH - RUINS_TUNNEL_MIN_LENGTH + 1));
            // Randomly branch left, right, or both
            const roll = Math.random();
            if (roll < 0.4) {
              carveHorizontalTunnel(ctx, x, y, -1, tunnelLength);
            } else if (roll < 0.8) {
              carveHorizontalTunnel(ctx, x, y, 1, tunnelLength);
            } else {
              carveHorizontalTunnel(ctx, x, y, -1, tunnelLength);
              carveHorizontalTunnel(ctx, x, y, 1, tunnelLength);
            }
          }
        }
        placedX.push(x);
        placed++;
      }

      console.log(`RuinsStage: placed ${placed} shafts`);
    },
  };
}

// ---------------------------------------------------------------------------
// RegionGenerator - orchestrates the pipeline
// ---------------------------------------------------------------------------

/**
 * RegionGenerator - staged world generation pipeline.
 *
 * Default stages (Minecraft-inspired order):
 *  1. Base Terrain  - fill the grid with layer-appropriate tiles
 *  2. Caves         - carve underground caves with min-separation & loot
 *  3. Boulders      - scatter boulders on solid tiles with solid support below
 *  4. Surface Features - starting holes, etc.
 *
 * Additional stages can be inserted via `addStage` / `addStageAfter`.
 */
export default class RegionGenerator {
  private stages: GenerationStage[] = [];

  constructor(modifiers?: NumericModifiers, specials: RegionModifier[] = []) {
    const mods: NumericModifiers = modifiers ?? {
      worldWidth: CONFIG.WORLD_WIDTH,
      worldHeight: CONFIG.WORLD_HEIGHT,
      caveAttempts: CAVE_DEFAULTS.attempts,
      boulderMultiplier: 1,
      resourceMultiplier: 1,
      spiderCount: SPIDER_COUNT_TARGET,
      wormCount: 1,
      surfaceOpenings: SURFACE_OPENING_COUNT,
    };

    const hasSpecial = (id: string) => specials.some(m => m.id === id);

    // mob count adjustments — order matters: boosts first, then hard zero
    if (hasSpecial('massive_caves')) {
      mods.spiderCount = Math.ceil(mods.spiderCount * 1.5);
    }
    if (hasSpecial('infested')) {
      mods.spiderCount = Math.ceil(mods.spiderCount * 4.0);
    }
    if (hasSpecial('writhing')) {
      mods.wormCount = Math.ceil(mods.wormCount * 3.0);
    }
    if (hasSpecial('uninhabited')) {
      mods.spiderCount = 0;
      mods.wormCount = 0;
    }
    if (hasSpecial('boulder_field')) {
      mods.boulderMultiplier = Math.max(mods.boulderMultiplier, 4.0);
    }

    // Apply world dimensions to CONFIG so all systems (TerrainSystem, GameScene, etc.) use the correct size.
    CONFIG.WORLD_WIDTH = mods.worldWidth;
    CONFIG.WORLD_HEIGHT = mods.worldHeight;

    const specialIds = specials.map(m => m.id).join(', ') || 'none';
    console.log(
      `RegionGenerator: modifiers — worldWidth=${mods.worldWidth}, worldHeight=${mods.worldHeight}, caveAttempts=${mods.caveAttempts}, boulderMultiplier=${mods.boulderMultiplier.toFixed(2)}, resourceMultiplier=${mods.resourceMultiplier.toFixed(2)}, spiderCount=${mods.spiderCount}, surfaceOpenings=${mods.surfaceOpenings}, specials=[${specialIds}]`,
    );

    // Register default stages in order
    this.stages.push(BaseTerrainStage);
    this.stages.push(SlopesStage);
    this.stages.push(
      createCaveStage({
        attempts: mods.caveAttempts,
        lootChance: CAVE_DEFAULTS.lootChance * mods.resourceMultiplier,
        ...(hasSpecial('massive_caves') ? { minSize: 12, maxSize: 30 } : {}),
      }),
    );
    this.stages.push(SurfaceFeaturesStage);
    this.stages.push(createSurfaceOpeningsStage(mods.surfaceOpenings));
    this.stages.push(createSpiderSpawnStage(mods.spiderCount));
    this.stages.push(createWormSpawnStage(mods.wormCount));
    if (hasSpecial('buried_cache')) {
      this.stages.push(createBuriedCacheStage());
    }
    if (hasSpecial('ruins')) {
      this.stages.push(createRuinsStage());
    }
    if (hasSpecial('old_camp')) {
      this.stages.push(createOldCampStage());
    }
    this.stages.push(createBoulderStage(mods.boulderMultiplier));
  }

  /**
   * Append a custom stage at the end of the pipeline.
   */
  addStage(stage: GenerationStage): void {
    this.stages.push(stage);
  }

  /**
   * Insert a custom stage right after the stage with the given name.
   */
  addStageAfter(afterName: string, stage: GenerationStage): void {
    const idx = this.stages.findIndex(s => s.name === afterName);
    if (idx >= 0) {
      this.stages.splice(idx + 1, 0, stage);
    } else {
      this.stages.push(stage);
    }
  }

  /**
   * Run all stages and return the generation context.
   */
  generate(): GenerationContext {
    console.log('RegionGenerator: starting generation pipeline...');

    const ctx: GenerationContext = {
      blocks: [],
      cavePositions: [],
      pendingItems: [],
      pendingSpiders: [],
      pendingLadders: [],
      pendingWorms: [],
    };

    for (const stage of this.stages) {
      console.log(`RegionGenerator: running stage "${stage.name}"`);
      stage.apply(ctx);
    }

    console.log('RegionGenerator: generation complete.');
    return ctx;
  }

  /**
   * Static helper that keeps the old one-call API.
   * Returns blocks only (legacy callers that don't need the full context).
   */
  static generateRegion(): Tile[][] {
    const gen = new RegionGenerator();
    return gen.generate().blocks;
  }
}
