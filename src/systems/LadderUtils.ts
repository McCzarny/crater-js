import { CONFIG } from '../config';
import TerrainSystem from './TerrainSystem';

export function canPlaceLadderAt(x: number, y: number, terrainSystem: TerrainSystem): boolean {
  if (y <= CONFIG.SURFACE_HEIGHT - 2) {
    return false; // Can't grow above surface
  }
  const block = terrainSystem.getBlockAt(x, y);
  const hasLadder = terrainSystem.hasLadder(x, y);
  return (!block || !block.solid) && !hasLadder;
}

export function getNextLadderCoordinate(
  x: number,
  y: number,
  terrainSystem: TerrainSystem,
): { x: number; y: number } | null {
  let currentY = y;
  for (let iteration = 0; iteration < 20; iteration++) {
    if (currentY <= CONFIG.SURFACE_HEIGHT - 2) {
      return null; // Reached surface, stop
    }

    if (terrainSystem.hasLadder(x, currentY)) {
      currentY--;
      continue;
    }
    const block = terrainSystem.getBlockAt(x, currentY);
    if (block && !block.solid) {
      return { x, y: currentY };
    }
    return null;
  }
  return null;
}
