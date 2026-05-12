export interface RegionModifiers {
  id: string;
  name: string;
  description: string;
  /** IDs of other modifiers that cannot coexist with this one. */
  cancels: string[];
}

export const SPECIAL_MODIFIER_POOL: readonly RegionModifiers[] = [
  {
    id: 'massive_caves',
    name: 'Massive Caves',
    description: 'This region undergrounds have bigger caves than usual.',
    cancels: [],
  },
  {
    id: 'no_mobs',
    name: 'No Mobs',
    description: 'No living beings were seen in this region.',
    cancels: ['infested'],
  },
  {
    id: 'essence_drain',
    name: 'Essence Drain',
    description: 'The connection with the Unity is disrupted, making it drain faster.',
    cancels: [],
  },
  {
    id: 'ruins',
    name: 'Ruins',
    description: 'It looks that there was some activity here in the past.',
    cancels: [],
  },
  {
    id: 'old_camp',
    name: 'Old Camp',
    description: 'On the surface there are some remnants of a previous expedition.',
    cancels: [],
  },
  {
    id: 'infested',
    name: 'Infested',
    description: 'The region is swarming with Essence Spiders. Far more dens than usual.',
    cancels: ['no_mobs'],
  },
  {
    id: 'boulder_field',
    name: 'Boulder Field',
    description: 'The underground is choked with boulders, making passage difficult.',
    cancels: [],
  },
  {
    id: 'buried_cache',
    name: 'Buried Cache',
    description: 'A cluster of precious minerals lies hidden in the deepest cave.',
    cancels: [],
  },
];

/**
 * Randomly selects 0–maxCount modifiers from the pool, respecting cancellation rules.
 */
export function selectRegionModifiers(
  pool: readonly RegionModifiers[] = SPECIAL_MODIFIER_POOL,
  maxCount: number = 4,
): RegionModifiers[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const targetCount = Math.floor(Math.random() * (maxCount + 1)); // 0–maxCount
  const selected: RegionModifiers[] = [];
  const cancelledIds = new Set<string>();

  for (const modifier of shuffled) {
    if (selected.length >= targetCount) {
      break;
    }
    if (cancelledIds.has(modifier.id)) {
      continue;
    }
    selected.push(modifier);
    for (const id of modifier.cancels) {
      cancelledIds.add(id);
    }
  }

  return selected;
}
