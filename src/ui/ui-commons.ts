import Phaser from 'phaser';

export interface ButtonOptions {
  depth?: number;
  useHandCursor?: boolean;
  text?: string;
  fontSize?: string;
  color?: string;
  icon?: string;
}

export interface ButtonElements {
  rect: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text | null;
  icon: Phaser.GameObjects.Sprite;
  progressOverlay: Phaser.GameObjects.Rectangle;
}

interface IconReturn {
  bg: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Sprite;
}

export interface ItemIconReturn {
  bg: Phaser.GameObjects.Sprite;
  image: Phaser.GameObjects.Sprite;
}

// Common utilities for UI components
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: ButtonOptions = {},
): ButtonElements {
  const rect = scene.add
    .sprite(x, y, 'hud_icon')
    .setScrollFactor(0)
    .setDepth(opts.depth ?? 200)
    .setInteractive({ useHandCursor: !!opts.useHandCursor });

  const progressOverlay = scene.add
    .rectangle(x, y, rect.width, rect.height, 0x00ff00, 0.25)
    .setScrollFactor(0)
    .setDepth((opts.depth ?? 201) + 1)
    .setVisible(false);

  const label = opts.text
    ? scene.add.text(x, y, opts.text, {
        fontSize: opts.fontSize ?? '12px',
        color: opts.color ?? '#ffffff',
        fontFamily: 'monospace',
      })
    : null;

  if (label) {
    label.setOrigin(0.5).setScrollFactor(0).setDepth((opts.depth ?? 202) + 1);
  }

  const icon = scene.add
    .sprite(x, y, opts.icon || '')
    .setScrollFactor(0)
    .setDepth((opts.depth ?? 203) + 1);

  return { rect, label, icon, progressOverlay };
}

export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number = 0x222222,
  alpha: number = 0.8,
  depth: number = 190,
): Phaser.GameObjects.Rectangle {
  const panel = scene.add
    .rectangle(x, y, width, height, color, alpha)
    .setScrollFactor(0)
    .setDepth(depth)
    .setOrigin(0.5);

  return panel;
}

export function makeItemIcon(scene: Phaser.Scene, x: number, y: number): ItemIconReturn {
  const bg = scene.add.sprite(x, y, 'hud_icon').setScrollFactor(0).setDepth(201);

  const iconSize = 32;

  const image = scene.add
    .sprite(x, y, '')
    .setDisplaySize(iconSize, iconSize)
    .setScrollFactor(0)
    .setDepth(202);

  return { bg, image };
}

export function makePortrait(
  scene: Phaser.Scene,
  x: number,
  y: number,
  raceId: string = '',
): Phaser.GameObjects.Sprite {
  const image = scene.add.sprite(x, y, raceId).setScrollFactor(0).setDepth(201);

  return image;
}

export function makeIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  iconId: string = '',
): IconReturn {
  const bg = scene.add
    .rectangle(x, y, size, size, 0x666666, 1)
    .setScrollFactor(0)
    .setDepth(201);

  const image = scene.add.sprite(x, y, iconId).setScrollFactor(0).setDepth(202);
  if (!iconId) {
    image.setVisible(false);
  }

  return { bg, image };
}
