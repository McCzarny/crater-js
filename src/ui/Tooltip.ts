import Phaser from 'phaser';
import { CONFIG } from '../config';

interface TooltipContent {
  text?: string;
  title?: string;
  icon?: string; // texture key
  description?: string[];
}

interface TooltipStyle {
  backgroundColor: number;
  backgroundAlpha: number;
  borderColor: number;
  borderWidth: number;
  borderRadius: number;
  padding: number;
  titleFontSize: string;
  textFontSize: string;
  titleColor: string;
  textColor: string;
  maxWidth: number;
  iconSize: number;
}

/**
 * Tooltip - A reusable tooltip system that auto-resizes based on content
 * Supports text, titles, descriptions, and icons
 */
export default class Tooltip {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  border: Phaser.GameObjects.Graphics;
  elements: Phaser.GameObjects.GameObject[];
  isVisible: boolean;
  style: TooltipStyle;
  currentWidth: number;
  currentHeight: number;
  currentX: number;
  currentY: number;

  constructor(scene: Phaser.Scene, customStyle?: Partial<TooltipStyle>) {
    this.scene = scene;
    this.isVisible = false;
    this.elements = [];
    this.currentWidth = 0;
    this.currentHeight = 0;
    this.currentX = 0;
    this.currentY = 0;

    // Default style
    this.style = {
      backgroundColor: 0x1a1a1a,
      backgroundAlpha: 0.95,
      borderColor: 0x666666,
      borderWidth: 2,
      borderRadius: 8,
      padding: 12,
      titleFontSize: '16px',
      textFontSize: '14px',
      titleColor: '#ffffff',
      textColor: '#cccccc',
      maxWidth: 300,
      iconSize: 32,
      ...customStyle,
    };

    // Create graphics for background and border
    this.background = scene.add.graphics();
    this.border = scene.add.graphics();

    // Create container to hold all tooltip elements
    this.container = scene.add.container(0, 0);
    this.container.add([this.border, this.background]);
    this.container.setDepth(10000); // Always on top
    this.container.setVisible(false);
  }

  /**
   * Show tooltip with content at specified position
   */
  show(x: number, y: number, content: TooltipContent): void {
    // Clear previous elements
    this.clear();

    // Build tooltip content
    const { width, height } = this.buildContent(content);

    // Draw background and border
    this.drawBackground(width, height);

    this.currentX = x;
    this.currentY = y;
    // Position tooltip (adjust to stay within screen bounds)
    this.positionTooltip(x, y, width, height);

    // Show container
    this.container.setVisible(true);
    this.isVisible = true;
  }

  /**
   * Hide tooltip
   */
  hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  /**
   * Update tooltip position (useful for following mouse)
   */
  updatePosition(x: number, y: number): void {
    if (!this.isVisible) {
      return;
    }
    this.currentX = x;
    this.currentY = y;
    this.positionTooltip(x, y, this.currentWidth, this.currentHeight);
  }

  /**
   * Update tooltip content without changing position
   */
  updateContent(content: TooltipContent): void {
    if (!this.isVisible) {
      return;
    }

    // Clear previous elements
    this.clear();

    // Rebuild content
    const { width, height } = this.buildContent(content);

    // Redraw background and border
    this.drawBackground(width, height);

    // Reposition with current coordinates
    this.positionTooltip(this.currentX, this.currentY, width, height);
  }

  /**
   * Build tooltip content and return dimensions
   */
  private buildContent(content: TooltipContent): { width: number; height: number } {
    const { padding, maxWidth, iconSize } = this.style;
    let currentY = padding;
    let maxContentWidth = 0;

    // Add icon if provided
    if (content.icon && this.scene.textures.exists(content.icon)) {
      const icon = this.scene.add.image(padding, currentY, content.icon);
      icon.setOrigin(0, 0);
      icon.setDisplaySize(iconSize, iconSize);
      this.container.add(icon);
      this.elements.push(icon);

      currentY += iconSize + padding;
      maxContentWidth = Math.max(maxContentWidth, iconSize);
    }

    // Add title if provided
    if (content.title) {
      const title = this.scene.add.text(padding, currentY, content.title, {
        fontSize: this.style.titleFontSize,
        color: this.style.titleColor,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        wordWrap: { width: maxWidth - padding * 2 },
      });
      title.setOrigin(0, 0);
      this.container.add(title);
      this.elements.push(title);

      const bounds = title.getBounds();
      currentY += bounds.height + padding / 2;
      maxContentWidth = Math.max(maxContentWidth, bounds.width);
    }

    // Add main text if provided
    if (content.text) {
      const text = this.scene.add.text(padding, currentY, content.text, {
        fontSize: this.style.textFontSize,
        color: this.style.textColor,
        fontFamily: 'monospace',
        wordWrap: { width: maxWidth - padding * 2 },
      });
      text.setOrigin(0, 0);
      this.container.add(text);
      this.elements.push(text);

      const bounds = text.getBounds();
      currentY += bounds.height + padding / 2;
      maxContentWidth = Math.max(maxContentWidth, bounds.width);
    }

    // Add description lines if provided
    if (content.description && content.description.length > 0) {
      content.description.forEach((line, index) => {
        const descText = this.scene.add.text(padding, currentY, line, {
          fontSize: this.style.textFontSize,
          color: this.style.textColor,
          fontFamily: 'monospace',
          wordWrap: { width: maxWidth - padding * 2 },
        });
        descText.setOrigin(0, 0);
        this.container.add(descText);
        this.elements.push(descText);

        const bounds = descText.getBounds();
        currentY += bounds.height + (index < content.description!.length - 1 ? padding / 3 : 0);
        maxContentWidth = Math.max(maxContentWidth, bounds.width);
      });

      currentY += padding / 2;
    }

    // Calculate final dimensions
    const finalWidth = maxContentWidth + padding * 2;
    const finalHeight = currentY + padding / 2;

    this.currentWidth = finalWidth;
    this.currentHeight = finalHeight;

    return { width: finalWidth, height: finalHeight };
  }

  /**
   * Draw background and border
   */
  private drawBackground(width: number, height: number): void {
    const { backgroundColor, backgroundAlpha, borderColor, borderWidth, borderRadius } = this.style;

    // Clear previous graphics
    this.background.clear();
    this.border.clear();

    // Draw border
    this.border.lineStyle(borderWidth, borderColor, 1);
    this.border.strokeRoundedRect(0, 0, width, height, borderRadius);

    // Draw background
    this.background.fillStyle(backgroundColor, backgroundAlpha);
    this.background.fillRoundedRect(0, 0, width, height, borderRadius);
  }

  /**
   * Position tooltip, adjusting to stay within screen bounds
   */
  private positionTooltip(x: number, y: number, width: number, height: number): void {
    const screenWidth = CONFIG.GAME_WIDTH;
    const screenHeight = CONFIG.GAME_HEIGHT;
    const offset = 10; // Offset from cursor

    let finalX = x + offset;
    let finalY = y + offset;

    // Adjust X position if tooltip would go off right edge
    if (finalX + width > screenWidth) {
      finalX = x - width - offset;
    }

    // Adjust X position if still off left edge
    if (finalX < 0) {
      finalX = 0;
    }

    // Adjust Y position if tooltip would go off bottom edge
    if (finalY + height > screenHeight) {
      finalY = y - height - offset;
    }

    // Adjust Y position if still off top edge
    if (finalY < 0) {
      finalY = 0;
    }

    this.container.setPosition(finalX, finalY);
  }

  /**
   * Clear all content elements
   */
  private clear(): void {
    this.elements.forEach(element => {
      element.destroy();
    });
    this.elements = [];
  }

  /**
   * Destroy tooltip and clean up resources
   */
  destroy(): void {
    this.clear();
    this.background.destroy();
    this.border.destroy();
    this.container.destroy();
  }

  /**
   * Set custom style (merges with existing style)
   */
  setStyle(customStyle: Partial<TooltipStyle>): void {
    this.style = { ...this.style, ...customStyle };
  }

  /**
   * Check if tooltip is currently visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }
}
