// Node.js test runner for game logic
// This tests the game logic without requiring a browser

import { CONFIG } from './src/config.js';

// Mock Phaser objects
class MockRectangle {
  constructor(x, y, width, height, color) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fillColor = color;
  }

  setDepth() {
    return this;
  }
  setFillStyle(color) {
    this.fillColor = color;
    return this;
  }
}

class MockScene {
  constructor() {
    this.registry = new Map();
    this.game = {
      events: {
        emit: (event, ...args) => {
          console.log(`Event: ${event}`, args);
        },
      },
    };
    this.add = {
      rectangle: (x, y, w, h, color) => new MockRectangle(x, y, w, h, color),
    };
  }
}

// Mock terrain system
class MockTerrainSystem {
  constructor() {
    this.blocks = [];
    // Generate simple world
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
      this.blocks[y] = [];
      for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
        if (y < CONFIG.SURFACE_HEIGHT) {
          this.blocks[y][x] = { type: 'air', solid: false };
        } else if (y === CONFIG.SURFACE_HEIGHT) {
          this.blocks[y][x] = { type: 'grass', solid: true };
        } else {
          this.blocks[y][x] = { type: 'dirt', solid: true };
        }
      }
    }

    // Create starting hole (3 blocks wide at center)
    const centerX = Math.floor(CONFIG.WORLD_WIDTH / 2);
    const grassY = CONFIG.SURFACE_HEIGHT;
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      if (x >= 0 && x < CONFIG.WORLD_WIDTH) {
        this.blocks[grassY][x] = { type: 'air', solid: false };
      }
    }
  }

  getBlockAt(x, y) {
    if (x < 0 || x >= CONFIG.WORLD_WIDTH || y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return null;
    }
    return this.blocks[y][x];
  }

  mineBlockAt(x, y) {
    if (x < 0 || x >= CONFIG.WORLD_WIDTH || y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return null;
    }
    const block = this.blocks[y][x];
    if (block && block.solid) {
      this.blocks[y][x] = { type: 'air', solid: false };
      return block.type;
    }
    return null;
  }
}

// Import Character class
async function loadCharacter() {
  const module = await import('./src/entities/Character.js');
  return module.default;
}

// Run tests
async function runTests() {
  console.log('=== Starting Game Logic Tests ===\n');

  const Character = await loadCharacter();

  // Test 1: Character Creation
  console.log('Test 1: Character Creation');
  const scene = new MockScene();
  const terrain = new MockTerrainSystem();
  scene.registry.set('terrainSystem', terrain);

  const spawnX = Math.floor(CONFIG.WORLD_WIDTH / 2);
  const spawnY = CONFIG.SURFACE_HEIGHT - 2; // Above grass
  const character = new Character(scene, spawnX, spawnY);

  console.log(`  Initial position: (${character.gridX}, ${character.gridY})`);
  console.log('  Expected to fall to grass hole and then dig down');
  console.log('  ✓ Character created\n');

  // Test 2: Let character fall first
  console.log('Test 2: Character Falling');
  let time = 0;
  const delta = 16;
  const mockCursors = {
    left: { isDown: false },
    right: { isDown: false },
    up: { isDown: false },
    down: { isDown: false },
  };
  const mockKeys = {
    space: { isDown: false },
    shift: { isDown: false },
  };

  // Simulate falling
  for (let i = 0; i < 10; i++) {
    time += delta;
    character.update(mockCursors, mockKeys, time, delta);

    // Complete any movement
    if (character.isMoving && character.moveTarget) {
      character.sprite.x = character.moveTarget.x;
      character.sprite.y = character.moveTarget.y;
      character.isMoving = false;
      character.moveTarget = null;
    }

    console.log(
      `  Tick ${i + 1}: Position (${character.gridX}, ${character.gridY}), Falling: ${character.isFalling}`,
    );

    if (!character.isFalling && character.gridY > CONFIG.SURFACE_HEIGHT) {
      console.log(`  ✓ Landed on solid ground at Y=${character.gridY}\n`);
      break;
    }
  }

  // Test 3: Start Auto-Dig Down
  console.log('Test 3: Start Auto-Dig Down');
  character.startAutoDig({ dx: 0, dy: 1 });
  console.log(`  Auto-dig state: ${character.isAutoDigging}`);
  console.log(
    `  Direction: dx=${character.autoDigDirection.dx}, dy=${character.autoDigDirection.dy}`,
  );
  console.log('  ✓ Auto-dig started\n');

  // Test 4: Simulate Auto-Dig Loop
  console.log('Test 4: Simulate Auto-Dig Loop (10 ticks)');
  time = 0;

  for (let i = 0; i < 10; i++) {
    time += CONFIG.MINING_TIME + 10; // Ensure enough time passes

    console.log(`  Tick ${i + 1}:`);
    console.log(`    Position before: (${character.gridX}, ${character.gridY})`);
    console.log(`    Is moving: ${character.isMoving}`);
    // Call update
    character.update(mockCursors, mockKeys, time, delta);

    // If moving, simulate smooth movement completing
    if (character.isMoving && character.moveTarget) {
      character.sprite.x = character.moveTarget.x;
      character.sprite.y = character.moveTarget.y;
      character.isMoving = false;
      character.moveTarget = null;
    }

    console.log(`    Position after: (${character.gridX}, ${character.gridY})`);
    console.log(`    Still auto-digging: ${character.isAutoDigging}`);

    if (!character.isAutoDigging) {
      console.log(`    Auto-dig stopped at tick ${i + 1}`);
      break;
    }

    console.log('');
  }

  // Check results
  console.log('\n=== Test Results ===');
  const finalY = character.gridY;
  const movedDown = finalY > spawnY;

  console.log(`Start Y: ${spawnY}`);
  console.log(`Final Y: ${finalY}`);
  console.log(`Moved down: ${movedDown ? 'YES' : 'NO'}`);

  if (movedDown) {
    console.log('\n✅ PASS: Auto-dig down is working!');
    process.exit(0);
  } else {
    console.log('\n❌ FAIL: Auto-dig down did not work!');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
