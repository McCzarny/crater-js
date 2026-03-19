# Crater - Mining Game

A 2D side-view mining and exploration game inspired by the classic Diggers (1993).

## Features (Initial Version)

- **Procedurally generated underground world** with multiple layers
- **3 playable races** - Tribe of the Mask, Cult of the Spore, Order of the Seed
- **Race-specific stats** - different mining speeds and movement speeds
- **Character switching** - control different characters with unique abilities
- **Basic mining mechanics** - dig through dirt, stone, and deeper layers
- **Resource collection** - find coal, iron, gold, and diamonds
- **Physics-based movement** - walk, jump, and navigate underground
- **Race-specific graphics** - each character has unique visual appearance

## How to Play

### Controls

- **Character Selection Buttons** (bottom of screen): Click to switch between characters
- **Mouse Click** (near player): Open directional dig menu
- **Arrow Keys**: Move left/right, jump up/down
- **Space**: Mine adjacent blocks manually
- **E**: Pick up item on current tile
- **Q**: Toggle search mode (auto-move and pickup)
- **Shift**: Sprint (move faster) / Speed up digging (500ms per tile when auto-digging)
- **ESC**: Cancel all active actions (dig/search/mine)

### Characters & Races

The game features 3 playable races, each with unique stats:

#### Tribe of the Mask

- Tribal warriors wearing ceremonial masks
- **Mining Speed**: 100% (base)
- **Movement Speed**: 100% (base)
- Balanced stats for all-around gameplay

#### Cult of the Spore (Fungus)

- Mole-like creatures with fungal growths
- **Mining Speed**: 150% (50% faster digging!)
- **Movement Speed**: 100% (base)
- Best for rapid excavation

#### Order of the Seed (Petal)

- Plant-based beings with leafy appendages
- **Mining Speed**: 100% (base)
- **Movement Speed**: 85% (15% slower)
- More methodical, plant-like pace

Click the character icons at the bottom of the screen to switch between them!

### Gameplay

1. Start at the surface with **3 characters** (one of each race)
2. **Click character icons** at the bottom to switch between them
3. **Click near your character** to open the directional dig menu
4. **Select a direction** (↑ ↓ ← →) to start continuous digging
5. The character will automatically dig and move in that direction (time varies by race)
6. **Hold Shift while auto-digging** to speed up to 500ms per block (fast testing mode)
7. Auto-dig stops when hitting an unbreakable block (like grass) or the edge
8. Press **ESC** to cancel any active action at any time
9. **Only one action can be active at a time** - starting a new action (move, dig, search, mine) will cancel the previous one
10. When mining blocks, there's a **chance items will drop** (gems, crystals, gold)
11. Items appear as **diamond-shaped sprites** on the ground and fall down due to gravity
12. Press **E** to pick up an item on your current tile
13. You have **2 inventory slots** - inventory shown at top-left
14. Press **Q** to enter **search mode**: character will automatically move left/right and pick up items
15. Search mode automatically reverses direction when hitting walls or edges
16. Search mode stops when inventory is full, or press **Q** or **ESC** to cancel manually

## Development

### Prerequisites

- Node.js (v20 or higher)
- npm

### Installation

```bash
npm install
```

### Running the Game

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` folder, ready to deploy to GitHub Pages.

## Technology Stack

- **Phaser 3** - Game framework
- **Vite** - Build tool and dev server
- **JavaScript (ES6+)** - Programming language

## Project Structure

```
crater-js/
├── src/
│   ├── main.js              # Game initialization
│   ├── config.js            # Configuration constants
│   ├── scenes/              # Phaser scenes
│   │   ├── BootScene.js     # Loading scene
│   │   ├── GameScene.js     # Main gameplay
│   │   └── UIScene.js       # UI overlay
│   ├── entities/            # Game entities
│   │   └── Character.js     # Player character
│   └── systems/             # Game systems
│       └── TerrainSystem.js # Terrain generation and mining
├── index.html               # Entry point
└── package.json             # Dependencies
```

## Roadmap

### Current Version (v0.1)

- ✅ Basic terrain generation
- ✅ Player movement and physics
- ✅ Manual mining mechanics
- ✅ Directional dig menu
- ✅ Continuous auto-digging
- ✅ Sprint mode for fast digging (500ms per block)
- ✅ Item drop system with random chance
- ✅ Ground items with visual indicators
- ✅ Item gravity physics
- ✅ 2-slot inventory system
- ✅ Pick up action (E key)
- ✅ Search mode with auto-pickup (Q key)
- ✅ **3 playable races** (Tribe, Fungus, Petal)
- ✅ **Character switching system**
- ✅ **Race-specific stats** (mining speed, movement speed)
- ✅ Race-specific character graphics
- ✅ Race info display in UI
- ✅ Simple UI with character selection

### Planned Features

- Race-specific abilities (climbing, vines, tool upgrades, etc.)
- Multiple characters per race/squad management
- Improved graphics and animations
- Save/load system
- Strategic global map
- Economic system (Zargon Stock Exchange)
- AI opponents
- Cave systems and hazards
- Equipment and upgrades
- Sound effects and music

## License

MIT
