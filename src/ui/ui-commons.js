// Common utilities for UI components
export function createButton(scene, x, y, opts = {}) {
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
    label
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth((opts.depth ?? 202) + 1);
  }

  const icon = scene.add
    .sprite(x, y, opts.icon)
    .setScrollFactor(0)
    .setDepth((opts.depth ?? 203) + 1);

  return { rect, label, icon, progressOverlay };
}

export function createPanel(
  scene,
  x,
  y,
  width,
  height,
  color = 0x222222,
  alpha = 0.8,
  depth = 190,
) {
  const panel = scene.add
    .rectangle(x, y, width, height, color, alpha)
    .setScrollFactor(0)
    .setDepth(depth)
    .setOrigin(0.5);

  return panel;
}

export function makeItemIcon(scene, x, y) {
  const bg = scene.add.sprite(x, y, 'hud_icon').setScrollFactor(0).setDepth(201);

  const iconSize = 32;

  const image = scene.add
    .sprite(x, y, null)
    .setDisplaySize(iconSize, iconSize)
    .setScrollFactor(0)
    .setDepth(202);

  return { bg, image };
}

export function makePortrait(scene, x, y, raceId = '') {
  const image = scene.add.sprite(x, y, raceId).setScrollFactor(0).setDepth(201);

  return image;
}

export function makeIcon(scene, x, y, size, iconId = '') {
  const bg = scene.add.rectangle(x, y, size, size, 0x666666, 1).setScrollFactor(0).setDepth(201);

  const image = scene.add.sprite(x, y, iconId).setScrollFactor(0).setDepth(202);
  if (!iconId) {
    image.setVisible(false);
  }

  return { bg, image };
}
