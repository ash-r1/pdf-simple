/**
 * Configuration utilities for pdfjs-dist.
 *
 * This module provides automatic detection of CMap and font paths
 * from the pdfjs-dist installation. These paths are required for
 * proper rendering of PDFs with CJK fonts and standard fonts.
 *
 * @module config
 * @internal
 */

import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Gets a require function that works in both ESM and CJS environments.
 *
 * This is necessary because:
 * - ESM uses `import.meta.url` for module resolution
 * - CJS uses `__filename` for module resolution
 * - We need `require.resolve()` to find pdfjs-dist
 *
 * @returns A NodeRequire function for resolving module paths
 * @internal
 */
function getRequire(): NodeRequire {
  // ESM: use import.meta.url
  // CJS: use __filename (injected by bundler)
  try {
    // Try ESM first
    const url = import.meta?.url;
    if (url) {
      return createRequire(url);
    }
  } catch {
    // Fallback for CJS
  }

  // CJS fallback
  if (typeof __filename !== 'undefined') {
    return createRequire(__filename);
  }

  // Last resort: use process.cwd()
  return createRequire(path.join(process.cwd(), 'index.js'));
}

/**
 * Cached require function for module resolution.
 * @internal
 */
const localRequire: NodeRequire = getRequire();

/**
 * Cached path to the pdfjs-dist installation.
 * @internal
 */
let cachedPdfjsPath: string | null = null;

/**
 * Gets the installation path of the pdfjs-dist package.
 *
 * This function resolves the path to pdfjs-dist by finding its package.json
 * file and extracting the directory. The result is cached for performance.
 *
 * @returns The absolute path to the pdfjs-dist installation directory
 * @throws Error if pdfjs-dist is not installed
 * @internal
 */
function getPdfjsDistPath(): string {
  if (cachedPdfjsPath) {
    return cachedPdfjsPath;
  }

  try {
    const packageJsonPath = localRequire.resolve('pdfjs-dist/package.json');
    cachedPdfjsPath = path.dirname(packageJsonPath);
    return cachedPdfjsPath;
  } catch {
    throw new Error('pdfjs-dist is not installed. Please install it with: npm install pdfjs-dist');
  }
}

/**
 * Gets the URL/path to CMap files for CJK font support.
 *
 * CMap (Character Map) files are required for proper text rendering
 * in PDFs that use CJK (Chinese, Japanese, Korean) fonts. Without
 * these files, CJK text may not render correctly.
 *
 * @returns The path to the cmaps directory in pdfjs-dist
 *
 * @example
 * ```typescript
 * const cMapUrl = getCMapUrl()
 * // Returns something like '/path/to/node_modules/pdfjs-dist/cmaps/'
 * ```
 */
export function getCMapUrl(): string {
  const pdfjsPath = getPdfjsDistPath();
  return `${pdfjsPath}/cmaps/`;
}

/**
 * Gets the URL/path to standard font files.
 *
 * Standard fonts (like Helvetica, Times Roman, Courier) are used
 * by PDFs that reference these fonts without embedding them.
 * The font files are needed to render these PDFs correctly.
 *
 * @returns The path to the standard_fonts directory in pdfjs-dist
 *
 * @example
 * ```typescript
 * const fontUrl = getStandardFontDataUrl()
 * // Returns something like '/path/to/node_modules/pdfjs-dist/standard_fonts/'
 * ```
 */
export function getStandardFontDataUrl(): string {
  const pdfjsPath = getPdfjsDistPath();
  return `${pdfjsPath}/standard_fonts/`;
}

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
