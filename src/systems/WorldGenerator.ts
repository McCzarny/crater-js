import { CONFIG } from '../config';
import { TileType, TileRegistry, type Tile, type TileTypeValue } from './TileTypes';

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
}

/**
 * A single stage in the world generation pipeline.
 */
export interface GenerationStage {
  name: string;
  apply(ctx: GenerationContext): void;
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
// Stage 2: Caves
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

const BoulderStage: GenerationStage = {
  name: 'Boulders',
  apply(ctx: GenerationContext): void {
    let placed = 0;

    for (let y = CONFIG.SURFACE_HEIGHT + 1; y < CONFIG.WORLD_HEIGHT - 1; y++) {
      const depth = y - CONFIG.SURFACE_HEIGHT;
      const chance = getBoulderChance(depth);
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

const SpiderSpawnStage: GenerationStage = {
  name: 'SpiderSpawn',
  apply(ctx: GenerationContext): void {
    /** Tracks placed den centres for the separation constraint. */
    const denPositions: { x: number; y: number }[] = [];

    const minY = CONFIG.SURFACE_HEIGHT + SPIDER_DEN_MIN_DEPTH_BELOW_SURFACE;
    const maxY = CONFIG.WORLD_HEIGHT - 5;

    for (let attempt = 0; attempt < 200 && denPositions.length < SPIDER_COUNT_TARGET; attempt++) {
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

// ---------------------------------------------------------------------------
// WorldGenerator - orchestrates the pipeline
// ---------------------------------------------------------------------------

/**
 * WorldGenerator - staged world generation pipeline.
 *
 * Default stages (Minecraft-inspired order):
 *  1. Base Terrain  - fill the grid with layer-appropriate tiles
 *  2. Caves         - carve underground caves with min-separation & loot
 *  3. Boulders      - scatter boulders on solid tiles with solid support below
 *  4. Surface Features - starting holes, etc.
 *
 * Additional stages can be inserted via `addStage` / `addStageAfter`.
 */
export default class WorldGenerator {
  private stages: GenerationStage[] = [];

  constructor() {
    // Register default stages in order
    this.stages.push(BaseTerrainStage);
    this.stages.push(createCaveStage());
    this.stages.push(BoulderStage);
    this.stages.push(SurfaceFeaturesStage);
    this.stages.push(SpiderSpawnStage);
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
    console.log('WorldGenerator: starting generation pipeline...');

    const ctx: GenerationContext = {
      blocks: [],
      cavePositions: [],
      pendingItems: [],
      pendingSpiders: [],
    };

    for (const stage of this.stages) {
      console.log(`WorldGenerator: running stage "${stage.name}"`);
      stage.apply(ctx);
    }

    console.log('WorldGenerator: generation complete.');
    return ctx;
  }

  /**
   * Static helper that keeps the old one-call API.
   * Returns blocks only (legacy callers that don't need the full context).
   */
  static generateWorld(): Tile[][] {
    const gen = new WorldGenerator();
    return gen.generate().blocks;
  }
}
