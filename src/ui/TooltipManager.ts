import Phaser from 'phaser';
import Tooltip from './Tooltip';

interface TooltipConfig {
  text?: string;
  title?: string;
  icon?: string;
  description?: string[];
}

/**
 * TooltipManager - Centralized tooltip management for a scene
 * Handles showing/hiding tooltips and managing multiple tooltip instances
 */
export default class TooltipManager {
  scene: Phaser.Scene;
  tooltip: Tooltip;
  currentTarget: Phaser.GameObjects.GameObject | null;
  currentContentCallback: (() => TooltipConfig) | null;
  hoverDelay: number;
  hoverTimer: Phaser.Time.TimerEvent | null;

  constructor(scene: Phaser.Scene, hoverDelayMs: number = 300) {
    this.scene = scene;
    this.tooltip = new Tooltip(scene);
    this.currentTarget = null;
    this.currentContentCallback = null;
    this.hoverDelay = hoverDelayMs;
    this.hoverTimer = null;
  }

  /**
   * Register a game object to show tooltip on hover
   */
  registerTooltip(
    gameObject: Phaser.GameObjects.GameObject & { setInteractive?: (config?: object) => void },
    content: TooltipConfig | (() => TooltipConfig),
  ): void {
    // Make sure object is interactive
    if (gameObject.setInteractive && !gameObject.input) {
      gameObject.setInteractive({ useHandCursor: false });
    }

    // Add hover listeners
    gameObject.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      this.onPointerOver(gameObject, pointer, content);
    });

    gameObject.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.onPointerMove(gameObject, pointer);
    });

    gameObject.on('pointerout', () => {
      this.onPointerOut(gameObject);
    });

    // Clean up on destroy
    gameObject.once('destroy', () => {
      this.unregisterTooltip(gameObject);
    });
  }

  /**
   * Unregister a game object's tooltip
   */
  unregisterTooltip(gameObject: Phaser.GameObjects.GameObject): void {
    gameObject.off('pointerover');
    gameObject.off('pointermove');
    gameObject.off('pointerout');

    if (this.currentTarget === gameObject) {
      this.hideTooltip();
    }
  }

  /**
   * Show tooltip immediately at position
   */
  showTooltip(x: number, y: number, content: TooltipConfig): void {
    this.tooltip.show(x, y, content);
  }

  /**
   * Hide tooltip
   */
  hideTooltip(): void {
    if (this.hoverTimer) {
      this.hoverTimer.destroy();
      this.hoverTimer = null;
    }
    this.tooltip.hide();
    this.currentTarget = null;
    this.currentContentCallback = null;
  }

  /**
   * Handle pointer over
   */
  private onPointerOver(
    gameObject: Phaser.GameObjects.GameObject,
    pointer: Phaser.Input.Pointer,
    content: TooltipConfig | (() => TooltipConfig),
  ): void {
    this.currentTarget = gameObject;

    // Cancel any existing timer
    if (this.hoverTimer) {
      this.hoverTimer.destroy();
      this.hoverTimer = null;
    }

    // Start hover delay timer
    this.hoverTimer = this.scene.time.delayedCall(this.hoverDelay, () => {
      const tooltipContent = typeof content === 'function' ? content() : content;
      this.currentContentCallback = typeof content === 'function' ? content : null;
      this.tooltip.show(pointer.x, pointer.y, tooltipContent);
      this.hoverTimer = null;
    });
  }

  /**
   * Handle pointer move
   */
  private onPointerMove(
    gameObject: Phaser.GameObjects.GameObject,
    pointer: Phaser.Input.Pointer,
  ): void {
    if (this.currentTarget === gameObject && this.tooltip.getIsVisible()) {
      this.tooltip.updatePosition(pointer.x, pointer.y);
    }
  }

  /**
   * Handle pointer out
   */
  private onPointerOut(gameObject: Phaser.GameObjects.GameObject): void {
    if (this.currentTarget === gameObject) {
      this.hideTooltip();
    }
  }

  /**
   * Update hover delay
   */
  setHoverDelay(delayMs: number): void {
    this.hoverDelay = delayMs;
  }

  /**
   * Update tooltip content if visible (call this in scene's update loop)
   */
  update(): void {
    // Only update if tooltip is visible and we have a dynamic content callback
    if (this.tooltip.getIsVisible() && this.currentContentCallback) {
      const updatedContent = this.currentContentCallback();
      this.tooltip.updateContent(updatedContent);
    }
  }

  /**
   * Destroy manager and cleanup
   */
  destroy(): void {
    if (this.hoverTimer) {
      this.hoverTimer.destroy();
    }
    this.tooltip.destroy();
    this.currentTarget = null;
  }
}
