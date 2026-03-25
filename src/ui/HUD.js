import { createPanel, makeIcon, makeItemIcon, makePortrait, createButton } from './ui-commons.js';

export default class HUD {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.sections = {};
  }

  create() {
    const { GAME_WIDTH, GAME_HEIGHT } = {
      GAME_WIDTH: this.scene.sys.game.config.width,
      GAME_HEIGHT: this.scene.sys.game.config.height,
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
      } catch (e) {
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
      const icon = makeItemIcon(this.scene, x, y, 'hud_icon');
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
      const icon = makeIcon(this.scene, x, passY, 24, `P${i + 1}`);
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
    const standardActions = [];
    standardActions[0] = [];
    standardActions[0][0] = null;
    standardActions[0][1] = 'MoveUp';
    standardActions[0][2] = null;

    standardActions[0][3] = 'Stop';
    standardActions[0][4] = 'PickUp';
    standardActions[0][5] = 'Search';

    standardActions[1] = [];
    standardActions[1][0] = 'MoveLeft';
    standardActions[1][1] = 'MoveDown';
    standardActions[1][2] = 'MoveRight';

    standardActions[1][3] = 'DigLeft';
    standardActions[1][4] = 'DigDown';
    standardActions[1][5] = 'DigRight';

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
            if (!gameScene || !gameScene.player) {
              console.warn('HUD action: GameScene or player not available');
              return;
            }

            const player = gameScene.player;

            switch (actionName) {
              case 'MoveUp':
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(0, -1, false);
                }
                break;
              case 'MoveDown':
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(0, 1, false);
                }
                break;
              case 'MoveLeft':
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(-1, 0, false);
                }
                break;
              case 'MoveRight':
                if (player.movement && player.movement.tryMove) {
                  player.movement.tryMove(1, 0, false);
                }
                break;
              case 'DigLeft':
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: -1, dy: 0 });
                }
                break;
              case 'DigDown':
                if (player.mining && player.mining.startAutoDig) {
                  player.mining.startAutoDig({ dx: 0, dy: 1 });
                }
                break;
              case 'DigRight':
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
                if (player.inventory && player.inventory.tryPickup) {
                  player.inventory.tryPickup();
                }
                break;
              case 'Search':
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

  _makeBars(x, y) {
    const spacing = 18;
    const labels = ['HP', 'STA', 'PAT'];
    const colors = [0xff4444, 0x44ff44, 0x4444ff];
    const bars = [];
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

  destroy() {
    if (this.bg) {
      this.bg.destroy();
    }
    Object.values(this.sections).forEach(arr => {
      arr.forEach(item => {
        if (!item) {
          return;
        }
        if (item.rect) {
          item.rect.destroy();
        }
        if (item.label) {
          item.label.destroy();
        }
        if (item.bg) {
          item.bg.destroy();
        }
        if (item.fg) {
          item.fg.destroy();
        }
        if (item.label) {
          item.label.destroy();
        }
      });
    });
  }

  /**
   * Update HUD when active character changes. For now update the portrait.
   * @param {Character} character
   */
  updateCharacter(character) {
    if (!character || !this.sections || !this.sections.portrait) {
      return;
    }

    const portrait = this.sections.portrait;
    const raceTex = character.race || null;
    portrait.setTexture(`hud_portrait_${raceTex}`);
    portrait.setDisplaySize(100, 100);
  }

  /**
   * Update items displayed in HUD according to inventory array
   * @param {Array<string|null>} inventory
   */
  updateInventory(inventory) {
    if (!inventory || !this.sections || !this.sections.items) {
      return;
    }

    for (let i = 0; i < this.sections.items.length; i++) {
      const slot = inventory[i] ? inventory[i].toLowerCase() : null;
      const icon = this.sections.items[i];
      if (!icon || !icon.image) {
        continue;
      }

      if (slot) {
        icon.image.setTexture(slot);
        if (icon.image.setDisplaySize) {
          icon.image.setDisplaySize(32, 32);
        }
      } else {
        // Show empty slot texture
        icon.image.setVisible(false);
      }
    }
  }

  /**
   * Update ability icons for the provided character
   * @param {Character} character
   */
  updateAbilities(character) {
    if (!this.sections || !this.sections.characterActions) {
      return;
    }

    // Clear all icons first
    this.sections.characterActions.forEach(slot => {
      if (slot.icon) {
        slot.icon.setVisible(false);
        slot.icon.removeAllListeners && slot.icon.removeAllListeners();
      }
    });

    if (!character || !character.abilities) {
      return;
    }

    const abilities = character.abilities.getAbilities();

    abilities.forEach((ability, index) => {
      const slot = this.sections.characterActions[index];
      if (!slot) {
        return;
      }

      // Determine texture key by constructor name mapping
      const ctor = ability.constructor && ability.constructor.name;
      let tex = 'hud_icon';
      if (ctor === 'ClimbingAbility') {
        tex = 'hud_climb';
      } else if (ctor === 'SeedPlantingAbility') {
        tex = 'hud_seed_planting';
      } else if (ctor === 'TeleportationAbility') {
        tex = 'hud_teleport';
      }

      if (this.scene.textures && this.scene.textures.exists && this.scene.textures.exists(tex)) {
        slot.icon.setTexture(tex);
      } else {
        slot.icon.setTexture('hud_icon');
      }

      slot.icon.setVisible(true);

      // Visual state: dim if cannot activate, highlight if active
      // const can = ability.canActivate ? ability.canActivate() : true;
      // const active = ability.isActive ? ability.isActive() : false;
      // slot.bg.setFillStyle(active ? 0x00aaff : can ? 0x335577 : 0x444444, 1);

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
    });
  }
}
