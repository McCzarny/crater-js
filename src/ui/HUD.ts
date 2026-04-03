import Phaser from 'phaser';
import {
  createPanel,
  makeIcon,
  makeItemIcon,
  makePortrait,
  createButton,
  ButtonElements,
  ItemIconReturn,
} from './ui-commons';
import type TooltipManager from './TooltipManager';

interface GameSceneType extends Phaser.Scene {
  player: Character;
}

interface Character {
  race: string;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  patience?: number;
  maxPatience?: number;
  stopAllActions?: () => void;
  abilities?: {
    getAbilities: () => unknown[];
  };
  inventory?: {
    tryPickup?: () => void;
    isSearching?: boolean;
    stopSearch?: () => void;
    startSearch?: () => void;
  };
  mining?: {
    startAutoDig?: (direction: { dx: number; dy: number }) => void;
  };
  movement?: {
    tryMove?: (dx: number, dy: number, isSprinting: boolean) => void;
  };
  sprite?: {
    clearTint?: () => void;
  };
}

interface BarElement {
  bg: Phaser.GameObjects.Rectangle;
  fg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface HUDSections {
  items: ItemIconReturn[];
  bars: BarElement[];
  passives: unknown[];
  portrait: Phaser.GameObjects.Sprite;
  standardActions: ButtonElements[];
  characterActions: ButtonElements[];
}

interface HUDOptions {
  [key: string]: unknown;
}

export default class HUD {
  scene: Phaser.Scene;
  options: HUDOptions;
  sections: Partial<HUDSections>;
  bg?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  tooltipManager?: TooltipManager;

  constructor(scene: Phaser.Scene, options: HUDOptions = {}) {
    this.scene = scene;
    this.options = options;
    this.sections = {};
  }

  /**
   * Set tooltip manager for ability tooltips
   */
  setTooltipManager(tooltipManager: TooltipManager): void {
    this.tooltipManager = tooltipManager;
  }

  create(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = {
      GAME_WIDTH: this.scene.sys.game.config.width as number,
      GAME_HEIGHT: this.scene.sys.game.config.height as number,
    };
    const w = GAME_WIDTH;
    const h = 167; // HUD height (fallback)

    // Background HUD: prefer using preloaded 'hud' texture, fallback to panel
    if (this.scene.textures && this.scene.textures.exists && this.scene.textures.exists('hud')) {
      this.bg = this.scene.add
        .image(w / 2, GAME_HEIGHT - h / 2, 'hud')
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(195);

      // Try to scale to fit width while preserving aspect ratio
      try {
        const img = this.scene.textures.get('hud').getSourceImage();
        if (img && img.width && img.height) {
          const scale = w / img.width;
          this.bg.setScale(scale);
        } else {
          this.bg.setDisplaySize(w, h);
        }
      } catch {
        this.bg.setDisplaySize(w, h);
      }
    } else {
      this.bg = createPanel(this.scene, w / 2, GAME_HEIGHT - h / 2, w, h, 0x224422, 1, 195);
    }

    const hudTop = GAME_HEIGHT - h;

    // Item section starts from 48x26 from top-left of HUD
    // Each icon is 48x48 with 12px spacing
    // Items are shown in 2x2 grid

    // Items (4 icons)
    this.sections.items = [];
    const itemsX = 48;
    const itemsY = hudTop + 26 + 24; // 26px from top + half icon height
    const itemsSpacing = 6;
    for (let i = 0; i < 4; i++) {
      const x = itemsX + (i % 2) * (48 + itemsSpacing);
      const y = itemsY + (i >= 2 ? 48 + itemsSpacing : 0); // Move to second row for last 2 items
      const icon = makeItemIcon(this.scene, x, y);
      icon.image.setVisible(false); // Start hidden until inventory is updated
      this.sections.items.push(icon);
    }

    // Bars (health, stamina, patience)
    const barsX = 230;
    const barsY = itemsY;
    this.sections.bars = this._makeBars(barsX, barsY);

    // Passive statuses (4 icons)
    this.sections.passives = [];
    // Passives are below bars
    const passX = barsX;
    const passY = barsY + 64; // Adjust this value as needed
    for (let i = 0; i < 4; i++) {
      const x = passX + (i - 1.5) * 30;
      const icon = makeIcon(this.scene, x, passY, 24, '');
      this.sections.passives.push(icon);
    }

    // Portrait
    const portraitX = 417;
    const portraitY = hudTop + 80;
    this.sections.portrait = makePortrait(this.scene, portraitX, portraitY, 'hud_icon');
    // Ensure portrait image has reasonable display size
    if (this.sections.portrait && this.sections.portrait.setDisplaySize) {
      this.sections.portrait.setDisplaySize(100, 100);
    }

    // Standard actions (6x2 grid) -> create mock buttons
    this.sections.standardActions = [];
    const stdX = 540;
    const stdY = hudTop + 26 + 32;
    const standardActions: string[][] = [];
    standardActions[0] = [];
    standardActions[0][0] = 'Search';
    standardActions[0][1] = 'MoveUp';
    standardActions[0][2] = 'PickUp';

    standardActions[0][3] = 'DigLeft';
    standardActions[0][4] = 'Stop';
    standardActions[0][5] = 'DigRight';

    standardActions[1] = [];
    standardActions[1][0] = 'MoveLeft';
    standardActions[1][1] = 'MoveDown';
    standardActions[1][2] = 'MoveRight';

    standardActions[1][3] = 'DigLeftDown';
    standardActions[1][4] = 'DigDown';
    standardActions[1][5] = 'DigRightDown';

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        if (!standardActions[r][c]) {
          continue;
        } // Skip empty slots
        const x = stdX + c * (48 + 2);
        const y = stdY + r * (48 + 2);
        const actionName = standardActions[r][c];
        const btn = createButton(this.scene, x, y, {
          useHandCursor: true,
          depth: 198,
          icon: `hud_standard_action_${actionName}`,
        });

        // Wire up button click to GameScene player actions
        try {
          btn.rect.on('pointerdown', () => {
            const gameScene = this.scene.scene.get('GameScene');
            if (!gameScene || !(gameScene as GameSceneType).player) {
              console.warn('HUD action: GameScene or player not available');
              return;
            }

            const player = (gameScene as GameSceneType).player as Character;

            switch (actionName) {
              case 'MoveUp':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(0, 1, false);
                }
                break;
              case 'MoveLeft':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(-1, 0, false);
                }
                break;
              case 'MoveRight':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(1, 0, false);
                }
                break;
              case 'DigLeft':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: -1, dy: 0 });
                }
                break;
              case 'DigDown':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: 0, dy: 1 });
                }
                break;
              case 'DigRight':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: 1, dy: 0 });
                }
                break;
              case 'Stop':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                break;
              case 'PickUp':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.inventory && player.inventory.tryPickup) {
                  player.inventory.tryPickup();
                }
                break;
              case 'DigLeftDown':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: -1, dy: 1 });
                }
                break;
              case 'DigRightDown':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: 1, dy: 1 });
                }
                break;
              case 'Search':
                if (player.stopAllActions) {
                  player.stopAllActions();
                }
                if (player.inventory) {
                  if (player.inventory.isSearching) {
                    if (player.inventory.stopSearch) {
                      player.inventory.stopSearch();
                    }
                    if (player.sprite && player.sprite.clearTint) {
                      player.sprite.clearTint();
                    }
                  } else {
                    if (player.stopAllActions) {
                      player.stopAllActions();
                    }
                    if (player.inventory.startSearch) {
                      player.inventory.startSearch();
                    }
                  }
                }
                break;
              default:
                console.log('HUD action clicked:', actionName);
            }
          });
        } catch (e) {
          console.warn('Failed to attach HUD button handler', e);
        }

        this.sections.standardActions.push(btn);
      }
    }

    // Character actions (3x2)
    this.sections.characterActions = [];
    const charX = 850;
    const charY = stdY;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = charX + c * (48 + 2);
        const y = charY + r * (48 + 2);
        const btn = createButton(this.scene, x, y, { useHandCursor: true, depth: 198 });
        this.sections.characterActions.push(btn);
      }
    }
  }

  _makeBars(x: number, y: number): BarElement[] {
    const spacing = 18;
    const labels = ['HP', 'STA', 'PAT'];
    const colors = [0xff4444, 0x44ff44, 0x4444ff];
    const bars: BarElement[] = [];
    for (let i = 0; i < labels.length; i++) {
      const yy = y + (i - 1) * spacing;
      const bg = this.scene.add
        .rectangle(x, yy, 120, 10, 0x333333, 1)
        .setScrollFactor(0)
        .setDepth(197);

      const fg = this.scene.add
        .rectangle(x - 60, yy, 120, 10, colors[i], 1)
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(198);

      const label = this.scene.add
        .text(x - 80, yy, labels[i], {
          fontSize: '10px',
          color: '#ffffff',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(199);

      bars.push({ bg, fg, label });
    }

    return bars;
  }

  destroy(): void {
    if (this.bg) {
      this.bg.destroy();
    }
    Object.values(this.sections).forEach(arr => {
      if (!Array.isArray(arr)) {
        return;
      }
      arr.forEach((item: unknown) => {
        if (!item || typeof item !== 'object') {
          return;
        }
        const obj = item as Record<string, unknown>;
        if (obj.rect && typeof obj.rect === 'object' && 'destroy' in obj.rect) {
          (obj.rect as Phaser.GameObjects.GameObject).destroy();
        }
        if (obj.label && typeof obj.label === 'object' && 'destroy' in obj.label) {
          (obj.label as Phaser.GameObjects.GameObject).destroy();
        }
        if (obj.bg && typeof obj.bg === 'object' && 'destroy' in obj.bg) {
          (obj.bg as Phaser.GameObjects.GameObject).destroy();
        }
        if (obj.fg && typeof obj.fg === 'object' && 'destroy' in obj.fg) {
          (obj.fg as Phaser.GameObjects.GameObject).destroy();
        }
        if (obj.image && typeof obj.image === 'object' && 'destroy' in obj.image) {
          (obj.image as Phaser.GameObjects.GameObject).destroy();
        }
      });
    });
  }

  /**
   * Update HUD when active character changes. For now update the portrait.
   * @param character - The character to update
   */
  updateCharacter(character: Character): void {
    if (!character || !this.sections || !this.sections.portrait) {
      return;
    }

    const portrait = this.sections.portrait;
    const raceTex = character.race || '';
    portrait.setTexture(`hud_portrait_${raceTex}`);
    portrait.setDisplaySize(100, 100);
  }

  /**
   * Update items displayed in HUD according to inventory array
   * @param inventory - Array of item names or null
   */
  updateInventory(inventory: (string | null)[]): void {
    if (!inventory || !this.sections || !this.sections.items) {
      return;
    }

    for (let i = 0; i < this.sections.items.length; i++) {
      const slot = inventory[i] ? inventory[i]!.toLowerCase() : null;
      const icon = this.sections.items[i];
      if (!icon || !icon.image) {
        continue;
      }

      if (slot) {
        icon.image.setTexture(slot);
        icon.image.setVisible(true);
      } else {
        // Show empty slot texture
        icon.image.setVisible(false);
      }
    }
  }

  /**
   * Update ability icons for the provided character
   * @param character - The character to update
   */
  updateAbilities(character: Character): void {
    if (!this.sections || !this.sections.characterActions) {
      return;
    }

    // Clear all icons first
    this.sections.characterActions.forEach(slot => {
      if (slot.icon) {
        slot.icon.setVisible(false);
        if (slot.icon.removeAllListeners) {
          slot.icon.removeAllListeners();
        }
      }
    });

    if (!character || !character.abilities) {
      return;
    }

    interface Ability {
      texture: () => string;
      name: () => string;
      description: () => string;
      cooldownRemaining: number;
    }
    const abilities = character.abilities.getAbilities() as Ability[];

    abilities.forEach((ability, index) => {
      const slot = this.sections.characterActions![index];
      if (!slot) {
        return;
      }

      // Determine texture key by constructor name mapping
      slot.icon.setTexture(ability.texture());
      slot.icon.setVisible(true);

      // Click handler: toggle ability via GameScene event
      const clickHandler = () => {
        const gameScene = this.scene.scene.get('GameScene');
        if (!gameScene) {
          return;
        }
        gameScene.events.emit('toggleAbility', index);
      };
      slot.icon.setInteractive({ useHandCursor: true });
      slot.icon.on('pointerdown', clickHandler);

      // Add tooltip if tooltipManager is available
      if (this.tooltipManager) {
        this.tooltipManager.registerTooltip(slot.icon, () => {
          const gameScene = this.scene.scene.get('GameScene') as GameSceneType;
          if (!gameScene || !gameScene.player) {
            return { text: 'No character selected' };
          }
          const currentAbility = gameScene.player.abilities?.getAbilities()[
            index
          ] as Ability | undefined;
          if (!currentAbility) {
            return { text: 'No ability' };
          }

          const cooldownText = currentAbility.cooldownRemaining
            ? `Cooldown: ${Math.ceil(currentAbility.cooldownRemaining / 1000)}s`
            : 'Ready';

          return {
            title: currentAbility.name(),
            description: [currentAbility.description(), cooldownText, 'Press R to activate'],
          };
        });
      }
    });
  }

  /**
   * Update ability usability and progress indicators. Call this every frame.
   * @param character - The character to update
   */
  updateAbilityIndicators(character: Character): void {
    if (!this.sections || !this.sections.characterActions) {
      return;
    }
    if (!character || !character.abilities) {
      return;
    }
    interface Ability {
      progress: () => number;
    }
    const abilities = character.abilities.getAbilities() as Ability[];
    abilities.forEach((ability, index) => {
      const slot = this.sections.characterActions![index];
      if (!slot || !slot.icon || !slot.progressOverlay) {
        return;
      }
      // Progress overlay
      const prog = ability.progress();
      const h = slot.icon.displayHeight;
      const w = slot.icon.displayWidth;
      if (prog > 0) {
        slot.progressOverlay.setVisible(true);
        slot.progressOverlay.setDisplaySize(w, h * prog);
        slot.progressOverlay.setY(slot.icon.y + (h * (1 - prog)) / 2);
      } else {
        slot.progressOverlay.setVisible(false);
      }
    });
  }

  /**
   * Update health, stamina, and patience bars every frame.
   * @param character - The character to update
   */
  updateBars(character: Character): void {
    if (!this.sections || !this.sections.bars) {
      return;
    }
    if (!character) {
      return;
    }
    // Assume: bars[0]=HP, bars[1]=STA, bars[2]=PAT
    const bars = this.sections.bars;
    // Health
    if (bars[0] && character.health !== undefined && character.maxHealth) {
      const frac = Math.max(0, Math.min(1, character.health / character.maxHealth));
      bars[0].fg.setScale(frac, 1);
    }
    // Stamina
    if (bars[1] && character.stamina !== undefined && character.maxStamina) {
      const frac = Math.max(0, Math.min(1, character.stamina / character.maxStamina));
      bars[1].fg.setScale(frac, 1);
    }
    // Patience (optional, fallback to 1 if not present)
    if (bars[2]) {
      const patience = character.patience !== undefined ? character.patience : 1;
      const maxPatience = character.maxPatience !== undefined ? character.maxPatience : 1;
      const frac = maxPatience ? Math.max(0, Math.min(1, patience / maxPatience)) : 1;
      bars[2].fg.setScale(frac, 1);
    }
  }
}
