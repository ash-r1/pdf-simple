/**
 * Configuration for pdf-simple.
 *
 * This module provides default configuration values for PDF rendering.
 *
 * @module config
 * @internal
 */

/**
 * Default rendering options used when not specified by the user.
 *
 * These defaults are optimized for a balance between quality and file size:
 * - `scale: 1.5` - Renders at 108 DPI (1.5 × 72 DPI)
 * - `format: 'jpeg'` - Uses JPEG for smaller file sizes
 * - `quality: 0.85` - Good quality without excessive file size
 *
 * @internal
 */
export const DEFAULT_RENDER_OPTIONS = {
  /** Default scale factor (1.5 = 108 DPI) */
  scale: 1.5,
  /** Default output format */
  format: 'jpeg' as const,
  /** Default JPEG quality (0.85 = 85%) */
  quality: 0.85,
} as const;
