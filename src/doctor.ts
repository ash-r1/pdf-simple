/**
 * Doctor module for checking pdf-simple dependencies and configuration.
 *
 * This module provides diagnostic checks to verify that all required
 * dependencies (pdfjs-dist, canvas, native libraries) are properly
 * installed and configured.
 *
 * @module doctor
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { getCMapUrl, getStandardFontDataUrl } from './config.js';

/**
 * Gets a require function that works in both ESM and CJS environments.
 * @internal
 */
function getRequire(): NodeRequire {
  try {
    const url = import.meta?.url;
    if (url) {
      return createRequire(url);
    }
  } catch {
    // Fallback for CJS
  }

  if (typeof __filename !== 'undefined') {
    return createRequire(__filename);
  }

  return createRequire(path.join(process.cwd(), 'index.js'));
}

const localRequire: NodeRequire = getRequire();

/**
 * Result of a single diagnostic check.
 */
export interface CheckResult {
  /** Name of the check */
  name: string;
  /** Whether the check passed */
  ok: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Optional details or suggestions for fixing issues */
  details?: string;
}

/**
 * Overall result of running all diagnostic checks.
 */
export interface DoctorResult {
  /** Whether all checks passed */
  ok: boolean;
  /** Individual check results */
  checks: CheckResult[];
}

/**
 * Minimum required Node.js version.
 */
const MIN_NODE_VERSION = '20.0.0';

/**
 * Compare two semantic version strings.
 * @returns negative if a < b, 0 if a === b, positive if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

/**
 * Check Node.js version meets minimum requirements.
 */
function checkNodeVersion(): CheckResult {
  const currentVersion = process.versions.node;
  const isOk = compareVersions(currentVersion, MIN_NODE_VERSION) >= 0;

  return {
    name: 'Node.js version',
    ok: isOk,
    message: isOk
      ? `Node.js ${currentVersion} (>= ${MIN_NODE_VERSION} required)`
      : `Node.js ${currentVersion} is too old (>= ${MIN_NODE_VERSION} required)`,
    details: isOk ? undefined : `Please upgrade Node.js to version ${MIN_NODE_VERSION} or later.`,
  };
}

/**
 * Check if pdfjs-dist is installed and accessible.
 */
function checkPdfjsDist(): CheckResult {
  try {
    // Try to get CMap URL which requires pdfjs-dist to be resolved
    const cMapUrl = getCMapUrl();
    const pdfjsPath = path.dirname(cMapUrl);

    // Check if package.json exists
    const packageJsonPath = path.join(pdfjsPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return {
        name: 'pdfjs-dist',
        ok: false,
        message: 'pdfjs-dist package.json not found',
        details: 'Run: npm install pdfjs-dist',
      };
    }

    // Read version from package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const version = packageJson.version ?? 'unknown';

    return {
      name: 'pdfjs-dist',
      ok: true,
      message: `pdfjs-dist ${version} installed`,
    };
  } catch {
    return {
      name: 'pdfjs-dist',
      ok: false,
      message: 'pdfjs-dist not found',
      details: 'Run: npm install pdfjs-dist',
    };
  }
}

/**
 * Check if canvas package is installed and native bindings work.
 */
async function checkCanvas(): Promise<CheckResult> {
  // First, check if canvas package exists without loading it
  let canvasPath: string;
  let version = 'unknown';

  try {
    canvasPath = localRequire.resolve('canvas');
  } catch {
    return {
      name: 'canvas',
      ok: false,
      message: 'canvas package not installed',
      details: 'Run: npm install canvas',
    };
  }

  // Get canvas version
  try {
    const canvasPackagePath = localRequire.resolve('canvas/package.json');
    const canvasPackage = JSON.parse(fs.readFileSync(canvasPackagePath, 'utf-8'));
    version = canvasPackage.version ?? 'unknown';
  } catch {
    // Ignore version detection errors
  }

  // Check if native bindings exist
  const canvasDir = path.dirname(canvasPath);
  const bindingsPath = path.join(canvasDir, 'build', 'Release', 'canvas.node');

  if (!fs.existsSync(bindingsPath)) {
    // Also check for prebuild bindings location
    const prebuildPath = path.join(canvasDir, 'prebuilds');
    const hasPrebuild = fs.existsSync(prebuildPath);

    if (!hasPrebuild) {
      return {
        name: 'canvas',
        ok: false,
        message: `canvas ${version} installed but native bindings not built`,
        details: `Native dependencies missing. Install them first:
  macOS: brew install pkg-config cairo pango libpng jpeg giflib librsvg
  Ubuntu/Debian: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
  Alpine: apk add build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev

Then rebuild canvas: npm rebuild canvas`,
      };
    }
  }

  // Try to actually load and use canvas
  try {
    const canvas = await import('canvas');

    // Try to create a small canvas to verify native bindings work
    const testCanvas = canvas.createCanvas(10, 10);
    const ctx = testCanvas.getContext('2d');

    // Draw something to verify it works
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 10, 10);

    // Try to export to verify encoding works
    testCanvas.toBuffer('image/png');

    return {
      name: 'canvas',
      ok: true,
      message: `canvas ${version} installed with working native bindings`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common native binding errors
    if (
      errorMessage.includes('Could not find') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('canvas.node')
    ) {
      return {
        name: 'canvas',
        ok: false,
        message: `canvas ${version} native bindings failed to load`,
        details: `Native dependencies missing. Install them first:
  macOS: brew install pkg-config cairo pango libpng jpeg giflib librsvg
  Ubuntu/Debian: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
  Alpine: apk add build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev

Then reinstall canvas: npm rebuild canvas`,
      };
    }

    return {
      name: 'canvas',
      ok: false,
      message: `canvas failed: ${errorMessage}`,
      details: 'Check that native dependencies are installed correctly.',
    };
  }
}

/**
 * Check if CMap files exist for CJK font support.
 */
function checkCMapFiles(): CheckResult {
  try {
    const cMapUrl = getCMapUrl();

    if (!fs.existsSync(cMapUrl)) {
      return {
        name: 'CMap files',
        ok: false,
        message: 'CMap directory not found',
        details: `Expected at: ${cMapUrl}
Reinstall pdfjs-dist: npm install pdfjs-dist`,
      };
    }

    // Check for some common CMap files (pdfjs-dist uses .bcmap binary format)
    const requiredCMaps = ['UniJIS-UTF16-H.bcmap', 'UniGB-UTF16-H.bcmap', 'UniKS-UTF16-H.bcmap'];
    const missingCMaps: string[] = [];

    for (const cmap of requiredCMaps) {
      const cmapPath = path.join(cMapUrl, cmap);
      if (!fs.existsSync(cmapPath)) {
        missingCMaps.push(cmap);
      }
    }

    if (missingCMaps.length > 0) {
      return {
        name: 'CMap files',
        ok: false,
        message: `Missing CMap files: ${missingCMaps.join(', ')}`,
        details: 'Reinstall pdfjs-dist: npm install pdfjs-dist',
      };
    }

    // Count total CMap files
    const files = fs.readdirSync(cMapUrl);
    const cmapCount = files.filter((f) => f.endsWith('.bcmap')).length;

    return {
      name: 'CMap files',
      ok: true,
      message: `${cmapCount} CMap files found (CJK font support ready)`,
    };
  } catch (error) {
    return {
      name: 'CMap files',
      ok: false,
      message: 'Failed to check CMap files',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if standard font files exist.
 */
function checkStandardFonts(): CheckResult {
  try {
    const fontUrl = getStandardFontDataUrl();

    if (!fs.existsSync(fontUrl)) {
      return {
        name: 'Standard fonts',
        ok: false,
        message: 'Standard fonts directory not found',
        details: `Expected at: ${fontUrl}
Reinstall pdfjs-dist: npm install pdfjs-dist`,
      };
    }

    // Check for some standard font files (pdfjs-dist uses Foxit and Liberation fonts)
    const requiredFonts = [
      'FoxitSerif.pfb',
      'FoxitSymbol.pfb',
      'FoxitDingbats.pfb',
      'LiberationSans-Regular.ttf',
    ];
    const missingFonts: string[] = [];

    for (const font of requiredFonts) {
      const fontPath = path.join(fontUrl, font);
      if (!fs.existsSync(fontPath)) {
        missingFonts.push(font);
      }
    }

    if (missingFonts.length > 0) {
      return {
        name: 'Standard fonts',
        ok: false,
        message: `Missing font files: ${missingFonts.join(', ')}`,
        details: 'Reinstall pdfjs-dist: npm install pdfjs-dist',
      };
    }

    // Count total font files (excluding LICENSE files)
    const files = fs.readdirSync(fontUrl);
    const fontCount = files.filter((f) => f.endsWith('.pfb') || f.endsWith('.ttf')).length;

    return {
      name: 'Standard fonts',
      ok: true,
      message: `${fontCount} standard font files found`,
    };
  } catch (error) {
    return {
      name: 'Standard fonts',
      ok: false,
      message: 'Failed to check standard fonts',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if PDF rendering actually works by creating and rendering a test PDF.
 * This uses dynamic imports exclusively to avoid loading canvas at module init time.
 * @param canvasOk - Whether the canvas check passed
 */
async function checkPdfRendering(canvasOk: boolean): Promise<CheckResult> {
  // Skip rendering test if canvas is not working
  if (!canvasOk) {
    return {
      name: 'PDF rendering',
      ok: false,
      message: 'Skipped (canvas not available)',
      details: 'Fix canvas installation first, then re-run doctor.',
    };
  }

  try {
    // Dynamic imports to avoid issues if packages are missing
    // We use the raw dependencies here instead of importing from ./index.js
    // to avoid bundling canvas at the top level
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const canvas = await import('canvas');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Create a minimal test PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([100, 100]);
    page.drawText('Test', { x: 10, y: 50, size: 12, font });
    const pdfBytes = await pdfDoc.save();

    // Load PDF using pdfjs-dist directly
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBytes),
      isEvalSupported: false,
      cMapUrl: getCMapUrl(),
      cMapPacked: true,
      standardFontDataUrl: getStandardFontDataUrl(),
    });
    const pdfDocument = await loadingTask.promise;

    // Render first page
    const pdfPage = await pdfDocument.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1.0 });
    const testCanvas = canvas.createCanvas(viewport.width, viewport.height);
    const context = testCanvas.getContext('2d');

    await pdfPage.render({
      // biome-ignore lint/suspicious/noExplicitAny: pdfjs-dist types are not fully compatible with canvas
      canvasContext: context as any,
      viewport,
    }).promise;

    // Try to export as PNG
    const buffer = testCanvas.toBuffer('image/png');
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);

    // Cleanup
    pdfPage.cleanup();
    await pdfDocument.destroy();

    if (!buffer || buffer.length === 0) {
      return {
        name: 'PDF rendering',
        ok: false,
        message: 'PDF rendering produced empty output',
        details: 'Check canvas native bindings and dependencies.',
      };
    }

    return {
      name: 'PDF rendering',
      ok: true,
      message: `PDF rendering works (${width}x${height} test image)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if pdf-lib is missing (it's a dev dependency)
    if (errorMessage.includes('pdf-lib')) {
      return {
        name: 'PDF rendering',
        ok: false,
        message: 'pdf-lib not available for test PDF generation',
        details:
          'Install pdf-lib to enable rendering test: npm install pdf-lib\nNote: This is only needed for the doctor command test.',
      };
    }

    return {
      name: 'PDF rendering',
      ok: false,
      message: `PDF rendering failed: ${errorMessage}`,
      details: 'Check that all dependencies are properly installed.',
    };
  }
}

/**
 * Run all diagnostic checks.
 *
 * @returns Promise resolving to DoctorResult with all check results
 *
 * @example
 * ```typescript
 * import { runDoctor } from 'pdf-simple/doctor'
 *
 * const result = await runDoctor()
 * if (result.ok) {
 *   console.log('All checks passed!')
 * } else {
 *   console.log('Some checks failed:')
 *   for (const check of result.checks) {
 *     if (!check.ok) {
 *       console.log(`  - ${check.name}: ${check.message}`)
 *     }
 *   }
 * }
 * ```
 */
export async function runDoctor(): Promise<DoctorResult> {
  const checks: CheckResult[] = [];

  // Synchronous checks
  checks.push(checkNodeVersion());
  checks.push(checkPdfjsDist());

  // Canvas check (required for rendering)
  const canvasResult = await checkCanvas();
  checks.push(canvasResult);

  // More checks
  checks.push(checkCMapFiles());
  checks.push(checkStandardFonts());

  // PDF rendering check (depends on canvas)
  checks.push(await checkPdfRendering(canvasResult.ok));

  const allPassed = checks.every((check) => check.ok);

  return {
    ok: allPassed,
    checks,
  };
}

/**
 * Format doctor results for console output.
 *
 * @param result - DoctorResult to format
 * @returns Formatted string for console output
 */
export function formatDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];

  lines.push('pdf-simple doctor');
  lines.push('=================');
  lines.push('');

  for (const check of result.checks) {
    const status = check.ok ? '\u2714' : '\u2718'; // ✔ or ✘
    const statusColor = check.ok ? '\x1b[32m' : '\x1b[31m'; // green or red
    const reset = '\x1b[0m';

    lines.push(`${statusColor}${status}${reset} ${check.name}: ${check.message}`);

    if (check.details && !check.ok) {
      // Indent details
      const detailLines = check.details.split('\n');
      for (const line of detailLines) {
        lines.push(`    ${line}`);
      }
      lines.push('');
    }
  }

  lines.push('');
  if (result.ok) {
    lines.push('\x1b[32mAll checks passed! pdf-simple is ready to use.\x1b[0m');
  } else {
    const failedCount = result.checks.filter((c) => !c.ok).length;
    lines.push(`\x1b[31m${failedCount} check(s) failed. Please fix the issues above.\x1b[0m`);
  }

  return lines.join('\n');
}
