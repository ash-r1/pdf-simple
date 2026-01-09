/**
 * Doctor module for checking pdf-simple dependencies and configuration.
 *
 * This module provides diagnostic checks to verify that all required
 * dependencies (@hyzyla/pdfium, sharp) are properly installed and configured.
 *
 * @module doctor
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

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
 * Check if @hyzyla/pdfium is installed and accessible.
 */
function checkPdfium(): CheckResult {
  try {
    const packageJsonPath = localRequire.resolve('@hyzyla/pdfium/package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const version = packageJson.version ?? 'unknown';

    return {
      name: '@hyzyla/pdfium',
      ok: true,
      message: `@hyzyla/pdfium ${version} installed`,
    };
  } catch {
    return {
      name: '@hyzyla/pdfium',
      ok: false,
      message: '@hyzyla/pdfium not found',
      details: 'Run: npm install @hyzyla/pdfium',
    };
  }
}

/**
 * Check if sharp is installed and working.
 */
async function checkSharp(): Promise<CheckResult> {
  let version = 'unknown';

  try {
    const packageJsonPath = localRequire.resolve('sharp/package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version ?? 'unknown';
  } catch {
    return {
      name: 'sharp',
      ok: false,
      message: 'sharp package not installed',
      details: 'Run: npm install sharp',
    };
  }

  try {
    // Try to actually load and use sharp
    const sharp = await import('sharp');

    // Create a simple test image to verify it works
    const testBuffer = await sharp
      .default(Buffer.from([255, 0, 0, 255]), {
        raw: { width: 1, height: 1, channels: 4 },
      })
      .png()
      .toBuffer();

    if (!testBuffer || testBuffer.length === 0) {
      return {
        name: 'sharp',
        ok: false,
        message: `sharp ${version} installed but image processing failed`,
        details: 'Try reinstalling sharp: npm rebuild sharp',
      };
    }

    return {
      name: 'sharp',
      ok: true,
      message: `sharp ${version} installed with working native bindings`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      name: 'sharp',
      ok: false,
      message: `sharp ${version} failed to load: ${errorMessage}`,
      details: 'Try reinstalling sharp: npm rebuild sharp',
    };
  }
}

/**
 * Check if PDFium WASM module can be initialized.
 */
async function checkPdfiumWasm(): Promise<CheckResult> {
  try {
    const { PDFiumLibrary } = await import('@hyzyla/pdfium');
    const library = await PDFiumLibrary.init();

    // Verify library is working by checking it's not null
    if (!library) {
      return {
        name: 'PDFium WASM',
        ok: false,
        message: 'PDFium WASM initialization returned null',
        details: 'Try reinstalling @hyzyla/pdfium',
      };
    }

    return {
      name: 'PDFium WASM',
      ok: true,
      message: 'PDFium WASM module initialized successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      name: 'PDFium WASM',
      ok: false,
      message: `PDFium WASM initialization failed: ${errorMessage}`,
      details: 'Check Node.js version compatibility and try reinstalling @hyzyla/pdfium',
    };
  }
}

/**
 * Check if PDF rendering actually works by creating and rendering a test PDF.
 * @param pdfiumOk - Whether the PDFium check passed
 * @param sharpOk - Whether the sharp check passed
 */
async function checkPdfRendering(pdfiumOk: boolean, sharpOk: boolean): Promise<CheckResult> {
  // Skip rendering test if dependencies are not working
  if (!(pdfiumOk && sharpOk)) {
    return {
      name: 'PDF rendering',
      ok: false,
      message: 'Skipped (dependencies not available)',
      details: 'Fix @hyzyla/pdfium and sharp installation first, then re-run doctor.',
    };
  }

  try {
    // Dynamic imports
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const { PDFiumLibrary } = await import('@hyzyla/pdfium');
    const sharp = await import('sharp');

    // Create a minimal test PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([100, 100]);
    page.drawText('Test', { x: 10, y: 50, size: 12, font });
    const pdfBytes = await pdfDoc.save();

    // Load and render using PDFium
    const library = await PDFiumLibrary.init();
    const document = await library.loadDocument(new Uint8Array(pdfBytes));
    const pdfPage = document.getPage(0);

    // Render page
    const image = await pdfPage.render({ render: 'bitmap', scale: 1.0 });
    const { data, width, height } = image;

    // Convert to PNG using sharp
    const buffer = await sharp
      .default(Buffer.from(data), {
        raw: { width, height, channels: 4 },
      })
      .png()
      .toBuffer();

    // Cleanup
    document.destroy();

    if (!buffer || buffer.length === 0) {
      return {
        name: 'PDF rendering',
        ok: false,
        message: 'PDF rendering produced empty output',
        details: 'Check @hyzyla/pdfium and sharp installation.',
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
  checks.push(checkPdfium());

  // Sharp check (required for image conversion)
  const sharpResult = await checkSharp();
  checks.push(sharpResult);

  // PDFium WASM check
  const pdfiumWasmResult = await checkPdfiumWasm();
  checks.push(pdfiumWasmResult);

  // PDF rendering check (depends on both)
  checks.push(await checkPdfRendering(pdfiumWasmResult.ok, sharpResult.ok));

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
