/**
 * Configuration utilities for pdfjs-dist
 * Automatically detects CMap and font paths
 */

import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Get a require function that works in both ESM and CJS
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

const localRequire: NodeRequire = getRequire();

let cachedPdfjsPath: string | null = null;

/**
 * Get the installation path of pdfjs-dist
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
 * Get the CMap URL for Japanese/CJK font support
 */
export function getCMapUrl(): string {
  const pdfjsPath = getPdfjsDistPath();
  return `${pdfjsPath}/cmaps/`;
}

/**
 * Get the standard font data URL
 */
export function getStandardFontDataUrl(): string {
  const pdfjsPath = getPdfjsDistPath();
  return `${pdfjsPath}/standard_fonts/`;
}

/**
 * Default render options
 */
export const DEFAULT_RENDER_OPTIONS = {
  scale: 1.5,
  format: 'jpeg' as const,
  quality: 0.85,
} as const;
