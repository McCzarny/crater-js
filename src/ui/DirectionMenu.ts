import Phaser from 'phaser';
import { CONFIG } from '../config';

interface Direction {
  name: string;
  dx: number;
  dy: number;
  angle: number;
  label: string;
}

interface DirectionButton {
  btn: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface ButtonWithDirection extends Direction {
  button: DirectionButton;
}

/**
 * Direction Menu - UI for selecting dig direction
 */
export default class DirectionMenu {
  scene: Phaser.Scene;
  isVisible: boolean;
  elements: (Phaser.GameObjects.Arc | Phaser.GameObjects.Text)[];
  buttons: ButtonWithDirection[];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isVisible = false;
    this.elements = []; // Store all UI elements
    this.buttons = [];

    this.createMenu();
  }

  /**
   * Create the menu UI
   */
  createMenu(): void {
    const centerX = CONFIG.GAME_WIDTH / 2;
    const centerY = 100;

    // Semi-transparent background circle
    const bg = this.scene.add
      .circle(centerX, centerY, 60, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);
    this.elements.push(bg);

    // Direction buttons (removed up - can't dig upward)
    const directions: Direction[] = [
      { name: 'right', dx: 1, dy: 0, angle: 0, label: '→' },
      { name: 'down', dx: 0, dy: 1, angle: 90, label: '↓' },
      { name: 'left', dx: -1, dy: 0, angle: 180, label: '←' },
    ];

    directions.forEach(dir => {
      const button = this.createDirectionButton(dir, centerX, centerY);
      this.buttons.push({ ...dir, button });
    });

    // Close button in center
    const closeBtn = this.scene.add
      .circle(centerX, centerY, 12, 0xff0000, 0.8)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      this.hide();
    });

    closeBtn.on('pointerover', () => {
      closeBtn.setFillStyle(0xff5555, 1);
    });

    closeBtn.on('pointerout', () => {
      closeBtn.setFillStyle(0xff0000, 0.8);
    });

    this.elements.push(closeBtn);

    const closeText = this.scene.add
      .text(centerX, centerY, '✕', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false);

    this.elements.push(closeText);
  }

  /**
   * Create a single direction button
   */
  createDirectionButton(dir: Direction, centerX: number, centerY: number): DirectionButton {
    const distance = 45;
    const angleRad = (dir.angle * Math.PI) / 180;
    const x = centerX + Math.cos(angleRad) * distance;
    const y = centerY + Math.sin(angleRad) * distance;

    // Button background
    const btn = this.scene.add
      .circle(x, y, 20, 0x00aa00, 0.8)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // Button label
    const label = this.scene.add
      .text(x, y, dir.label, {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false);

    // Hover effects
    btn.on('pointerover', () => {
      btn.setFillStyle(0x00ff00, 1);
      btn.setScale(1.1);
      label.setScale(1.1);
    });

    btn.on('pointerout', () => {
      btn.setFillStyle(0x00aa00, 0.8);
      btn.setScale(1);
      label.setScale(1);
    });

    // Click handler
    btn.on('pointerdown', () => {
      console.log('Direction button clicked:', dir.name);
      this.selectDirection(dir);
    });

    this.elements.push(btn);
    this.elements.push(label);

    return { btn, label };
  }

  /**
   * Show menu
   */
  show(): void {
    this.elements.forEach(el => el.setVisible(true));
    this.isVisible = true;
  }

  /**
   * Hide menu
   */
  hide(): void {
    this.elements.forEach(el => el.setVisible(false));
    this.isVisible = false;
  }

  /**
   * Handle direction selection
   */
  selectDirection(dir: Direction): void {
    console.log('Selecting direction:', dir);
    // Emit event for character to start auto-digging
    this.scene.events.emit('directionSelected', { dx: dir.dx, dy: dir.dy });
    this.hide();
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}
