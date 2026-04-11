import Phaser from 'phaser';

/**
 * Boot scene - loads initial assets and sets up the game
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load race icons
    this.load.image('tribe', 'resources/icons/races/tribe.png');
    this.load.image('fungus', 'resources/icons/races/fungus.png');
    this.load.image('petal', 'resources/icons/races/petal.png');
    this.load.image('skull', 'resources/icons/races/skull.png');

    // Load race character sprites
    this.load.image('tribe_character', 'resources/characters/tribe/tribe_character.png');
    this.load.image('fungus_character', 'resources/characters/fungus/fungus_character.png');
    this.load.image('petal_character', 'resources/characters/petal/petal_character.png');

    // Load race character animations
    this.load.aseprite('tribe_character_sheet', 'resources/characters/tribe/tribe_character_sheet.png', 'resources/characters/tribe/tribe_character_sheet.json');
    this.load.aseprite('fungus_character_sheet', 'resources/characters/fungus/fungus_character_sheet.png', 'resources/characters/fungus/fungus_character_sheet.json');
    this.load.aseprite('petal_character_sheet', 'resources/characters/petal/petal_character_sheet.png', 'resources/characters/petal/petal_character_sheet.json');

    // Bases
    this.load.image('vine', 'resources/tile-decals/vine.png');
    this.load.image('tribe-base', 'resources/structures/tribe_base.png');
    this.load.image('fungus-base', 'resources/structures/fungus_base.png');
    this.load.image('petal-base', 'resources/structures/petal_base.png');
    // Environment tiles
    this.load.image('boulder', 'resources/tiles/boulder.png');

    // Wind effects
    this.load.image('wind1', 'resources/tile-decals/wind_1.png');
    this.load.image('wind2', 'resources/tile-decals/wind_2.png');
    this.load.image('wind3', 'resources/tile-decals/wind_3.png');
    this.load.image('wind4', 'resources/tile-decals/wind_4.png');

    // Resource icons
    this.load.image('coal', 'resources/tile-decals/coal.png');
    this.load.image('diamond', 'resources/tile-decals/diamond.png');
    this.load.image('emerald', 'resources/tile-decals/emerald.png');
    this.load.image('amethyst', 'resources/tile-decals/amethyst.png');

    // Essence icons
    this.load.image('essence_grain', 'resources/tile-decals/essence_grain.png');
    this.load.image('essence_lump', 'resources/tile-decals/essence_lump.png');
    this.load.image('essence_chunk', 'resources/tile-decals/essence_chunk.png');
    this.load.image('essence_core', 'resources/tile-decals/essence_core.png');

    // Tile textures (add your own as needed)
    this.load.image('surface_1', 'resources/tiles/surface_1.png');
    this.load.image('surface_2', 'resources/tiles/surface_2.png');
    this.load.image('surface_3', 'resources/tiles/surface_3.png');
    this.load.image('surface_4', 'resources/tiles/surface_4.png');

    this.load.image('dirt_1', 'resources/tiles/dirt_1.png');
    this.load.image('dirt_2', 'resources/tiles/dirt_2.png');
    this.load.image('dirt_3', 'resources/tiles/dirt_3.png');
    this.load.image('dirt_4', 'resources/tiles/dirt_4.png');

    // UI
    this.load.image('hud', 'resources/ui/hud.png');
    this.load.image('hud_icon', 'resources/ui/hud_icon.png');
    this.load.image('hud_icon_error', 'resources/ui/hud_icon_error.png');
    this.load.image('hud_active_action', 'resources/ui/hud_active_action.png');

    this.load.image('hud_standard_action_MoveLeft', 'resources/ui/move_left.png');
    this.load.image('hud_standard_action_MoveRight', 'resources/ui/move_right.png');
    this.load.image('hud_standard_action_MoveDown', 'resources/ui/move_down.png');
    this.load.image('hud_standard_action_MoveUp', 'resources/ui/move_up.png');

    this.load.image('hud_standard_action_DigLeft', 'resources/ui/dig_left.png');
    this.load.image('hud_standard_action_DigRight', 'resources/ui/dig_right.png');
    this.load.image('hud_standard_action_DigDown', 'resources/ui/dig_down.png');
    this.load.image('hud_standard_action_DigLeftDown', 'resources/ui/dig_left_down.png');
    this.load.image('hud_standard_action_DigRightDown', 'resources/ui/dig_right_down.png');

    this.load.image('hud_standard_action_Search', 'resources/ui/search.png');
    this.load.image('hud_standard_action_Stop', 'resources/ui/stop.png');
    this.load.image('hud_standard_action_PickUp', 'resources/ui/pickup.png');

    this.load.image('hud_portrait_tribe', 'resources/ui/hud_portrait_tribe.png');
    this.load.image('hud_portrait_fungus', 'resources/ui/hud_portrait_fungus.png');
    this.load.image('hud_portrait_petal', 'resources/ui/hud_portrait_petal.png');

    this.load.image('hud_climb', 'resources/ui/hud_climb.png');
    this.load.image('hud_seed_planting', 'resources/ui/hud_seed_planting.png');
    this.load.image('hud_teleport', 'resources/ui/hud_teleport.png');

    this.load.image('trade_icon', 'resources/ui/trade_icon.png');
    this.load.image('transfer_essence_icon', 'resources/ui/transfer_essence_icon.png');
    this.load.image('ladder', 'resources/tile-decals/ladder.png');

    this.load.image('trader_portrait', 'resources/ui/trader_portrait.png');

    console.log('BootScene: Loading race icons and tile textures...');
  }

  create(): void {
    console.log('BootScene: Starting game...');
    this.anims.createFromAseprite('tribe_character_sheet');
    this.anims.createFromAseprite('fungus_character_sheet');
    this.anims.createFromAseprite('petal_character_sheet');

    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }
}
