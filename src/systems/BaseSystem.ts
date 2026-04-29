import Phaser from 'phaser';
import { CONFIG } from '../config';
import { TileType, TileRegistry } from './TileTypes';
import type TerrainSystem from './TerrainSystem';

/**
 * Interface for base data
 */
interface BaseData {
  gridX: number;
  gridY: number;
  centerGridX: number;
  centerGridY: number;
  sprite: Phaser.GameObjects.Sprite | null;
}

/**
 * Interface for base center position
 */
interface BaseCenter {
  gridX: number;
  gridY: number;
  pixelX: number;
  pixelY: number;
}

/**
 * Type for race keys
 */
type RaceKey = keyof typeof CONFIG.RACES;

/**
 * BaseSystem - manages race bases throughout the world
 * Each race has a 3x3 base on the surface that serves as their home
 */
export default class BaseSystem {
  scene: Phaser.Scene;
  terrainSystem: TerrainSystem;
  bases: Map<string, BaseData>;

  constructor(scene: Phaser.Scene, terrainSystem: TerrainSystem) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;
    this.bases = new Map();

    // Calculate base positions and place them
    this.placeAllBases();
  }

  /**
   * Place all race bases on the surface
   */
  placeAllBases(): void {
    const races = Object.keys(CONFIG.RACES) as RaceKey[];
    const surfaceY = CONFIG.SURFACE_HEIGHT - 3;

    // Calculate spacing between bases
    // We want to spread them out evenly across the world
    const totalSpacing = 12; // For testing we'll use a smaller spacing to fit all bases on the surface
    const gap = Math.floor(totalSpacing / (races.length + 1)); // Space between bases

    // Place each base
    let currentX = Math.floor(CONFIG.WORLD_WIDTH / 2) - gap;

    for (let i = 0; i < races.length; i++) {
      const raceKey = races[i];
      const race = CONFIG.RACES[raceKey];

      // Place base at calculated position
      this.placeBase(raceKey, currentX, surfaceY);

      // Move to next position
      currentX += CONFIG.BASE_SIZE + gap;

      console.log(
        `BaseSystem: Placed ${race.name} base at grid (${currentX - CONFIG.BASE_SIZE - gap}, ${surfaceY})`,
      );
    }
  }

  /**
   * Place a base for a specific race
   */
  placeBase(race: string, gridX: number, gridY: number): void {
    // Clear the area for the base (make it air)
    for (let dy = 0; dy < CONFIG.BASE_SIZE; dy++) {
      for (let dx = 0; dx < CONFIG.BASE_SIZE; dx++) {
        const x = gridX + dx;
        const y = gridY + dy;

        if (x >= 0 && x < CONFIG.WORLD_WIDTH && y >= 0 && y < CONFIG.WORLD_HEIGHT) {
          // Clear the block
          this.terrainSystem.blocks[y][x] = TileRegistry.createTile(TileType.AIR);

          // Remove any existing sprite
          const key = `${x},${y}`;
          if (this.terrainSystem.blockSprites.has(key)) {
            this.terrainSystem.blockSprites.get(key)!.destroy();
            this.terrainSystem.blockSprites.delete(key);
          }
        }
      }
    }

    // Place non-breakable surface under the base for visual consistency
    for (let dx = 0; dx < CONFIG.BASE_SIZE; dx++) {
      const x = gridX + dx;
      const y = gridY + CONFIG.BASE_SIZE; // Row just below the base

      if (x >= 0 && x < CONFIG.WORLD_WIDTH && y >= 0 && y < CONFIG.WORLD_HEIGHT) {
        // Create a non-breakable surface tile
        const surfaceTile = TileRegistry.createTile(TileType.SURFACE);
        this.terrainSystem.blocks[y][x] = surfaceTile;
        this.terrainSystem.renderBlock(x, y);
      }
    }
    // Create the base sprite
    const baseSprite = this.createBaseSprite(race, gridX, gridY);

    // Store base data
    this.bases.set(race, {
      gridX: gridX,
      gridY: gridY,
      centerGridX: gridX + Math.floor(CONFIG.BASE_SIZE / 2),
      centerGridY: gridY + Math.floor(CONFIG.BASE_SIZE / 2),
      sprite: baseSprite,
    });
  }

  /**
   * Create a sprite for a base
   */
  createBaseSprite(race: string, gridX: number, gridY: number): Phaser.GameObjects.Sprite | null {
    const pixelX = gridX * CONFIG.BLOCK_SIZE;
    const pixelY = gridY * CONFIG.BLOCK_SIZE;

    // Create sprite using the loaded base texture
    const textureKey = `${race}-base`;

    if (!this.scene.textures.exists(textureKey)) {
      console.error(`BaseSystem: Texture ${textureKey} not found!`);
      return null;
    }

    const sprite = this.scene.add.sprite(pixelX, pixelY, textureKey);

    // Set origin to top-left for easier positioning
    sprite.setOrigin(0, 0);

    // Scale sprite to fit 3x3 tiles (96x96 pixels)
    const targetSize = CONFIG.BASE_SIZE * CONFIG.BLOCK_SIZE;
    sprite.setDisplaySize(targetSize, targetSize);

    // Set depth so bases appear above terrain but below characters
    sprite.setDepth(100);

    return sprite;
  }

  /**
   * Get the base data for a specific race
   */
  getBase(race: string): BaseData | null {
    return this.bases.get(race) || null;
  }

  /**
   * Get the center position of a race's base (useful for teleportation)
   */
  getBaseCenter(race: string): BaseCenter | null {
    const base = this.bases.get(race);
    if (!base) {
      return null;
    }

    return {
      gridX: base.centerGridX,
      gridY: base.centerGridY,
      pixelX: base.centerGridX * CONFIG.BLOCK_SIZE,
      pixelY: base.centerGridY * CONFIG.BLOCK_SIZE,
    };
  }

  /**
   * Check if a position is inside any base
   */
  isInsideBase(gridX: number, gridY: number): string | null {
    for (const [race, base] of this.bases.entries()) {
      if (
        gridX >= base.gridX &&
        gridX < base.gridX + CONFIG.BASE_SIZE &&
        gridY >= base.gridY &&
        gridY < base.gridY + CONFIG.BASE_SIZE
      ) {
        return race;
      }
    }
    return null;
  }
}
