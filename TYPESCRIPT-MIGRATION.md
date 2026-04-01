# TypeScript Migration Guide

## Setup Complete! ✅

Your project is now configured for gradual TypeScript migration. All existing JavaScript files continue to work, and you can convert them to TypeScript one file at a time.

## What Was Changed

### Dependencies Added
- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@typescript-eslint/parser` - ESLint parser for TypeScript
- `@typescript-eslint/eslint-plugin` - ESLint plugin for TypeScript

### Configuration Files
- **tsconfig.json** - TypeScript configuration with `allowJs: true` for gradual migration
- **vite.config.ts** - Renamed from .js to .ts (Vite auto-detects)
- **.eslintrc.cjs** - Updated to support both .js and .ts files

### package.json Scripts
- Added `type-check` - Run TypeScript type checking without emitting files
- Updated `lint`, `lint:fix`, `format`, `format:check` to include .ts files

## Migration Strategy

### Phase 1: Setup (✅ DONE)
- TypeScript installed and configured
- Build system working with JS + TS support
- Type checking available

### Phase 2: Gradual Conversion
Convert files in this recommended order:

1. **Start with simple files** (no dependencies):
   - `src/config.js` → `src/config.ts`
   - `src/systems/TileTypes.js` → `src/systems/TileTypes.ts`

2. **Move to system files**:
   - `src/systems/BaseSystem.js`
   - `src/systems/ItemManager.js`
   - `src/systems/CharacterMovement.js`
   - `src/systems/CharacterMining.js`
   - `src/systems/CharacterInventory.js`
   - `src/systems/CharacterAbilities.js`

3. **Then core systems**:
   - `src/systems/WorldGenerator.js`
   - `src/systems/TerrainSystem.js`

4. **Entities**:
   - `src/entities/Character.js`

5. **Scenes**:
   - `src/scenes/BootScene.js`
   - `src/scenes/GameScene.js`
   - `src/scenes/UIScene.js`

6. **UI components**:
   - `src/ui/*.js` files

7. **Entry point last**:
   - `src/main.js`

### How to Convert a File

1. **Rename** `.js` → `.ts`
2. **Update imports** - remove `.js` extensions:
   ```ts
   // Before
   import { CONFIG } from '../config.js';
   
   // After
   import { CONFIG } from '../config';
   ```

3. **Add type annotations** gradually:
   ```ts
   // Start simple
   function calculate(x: number, y: number): number {
     return x + y;
   }
   
   // Add interface for complex objects
   interface PlayerData {
     health: number;
     stamina: number;
   }
   ```

4. **Run type-check**:
   ```bash
   npm run type-check
   ```

5. **Fix any errors** TypeScript finds

## Useful Commands

```bash
# Check types without building
npm run type-check

# Development with hot reload
npm run dev

# Build for production
npm run build

# Lint all files (JS + TS)
npm run lint

# Format all files
npm run format
```

## Tips

- **Don't rush**: Convert one file at a time
- **Test after each conversion**: Make sure the game still works
- **Start lenient**: `strict: false` is set, we'll tighten later
- **Use `any` sparingly**: It defeats the purpose, but OK for complex cases initially
- **Phaser types**: Phaser includes its own types, use them:
  ```ts
  class MyScene extends Phaser.Scene {
    sprite!: Phaser.GameObjects.Sprite;
  }
  ```

## Enabling Strict Mode (Later)

Once most files are converted, gradually enable strict checks in `tsconfig.json`:
1. `noImplicitAny: true`
2. `strictNullChecks: true`
3. `strict: true`

Fix errors after each step.

## Need Help?

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Phaser TypeScript: https://photonstorm.github.io/phaser3-docs/
- Ask me to help convert specific files!
