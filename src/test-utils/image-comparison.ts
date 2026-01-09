/**
 * Image comparison utility for visual regression testing.
 *
 * Uses pixelmatch to compare PNG images and manage snapshots.
 * Supports updating snapshots via UPDATE_SNAPSHOTS environment variable.
 *
 * @module test-utils/image-comparison
 * @internal
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Result of an image comparison.
 */
export interface ComparisonResult {
  /** Whether the images match within the threshold */
  match: boolean;
  /** Number of different pixels */
  diffPixels: number;
  /** Total number of pixels */
  totalPixels: number;
  /** Percentage of different pixels (0-100) */
  diffPercentage: number;
  /** Diff image buffer (PNG) if images don't match */
  diffImage?: Buffer;
}

/**
 * Options for image comparison.
 */
export interface ComparisonOptions {
  /** Matching threshold (0-1). Default: 0.1 */
  threshold?: number;
  /** Include anti-aliased pixels in diff. Default: true */
  includeAA?: boolean;
}

/**
 * Options for snapshot comparison.
 */
export interface SnapshotOptions extends ComparisonOptions {
  /** Directory to store snapshots. Default: __snapshots__ */
  snapshotDir?: string;
  /** Directory to store diff images on failure. Default: __diffs__ */
  diffDir?: string;
  /** Maximum allowed diff percentage (0-100). Default: 0 */
  maxDiffPercentage?: number;
}

/**
 * Compares two PNG images and returns the result.
 *
 * @param actual - Actual image buffer (PNG format)
 * @param expected - Expected image buffer (PNG format)
 * @param options - Comparison options
 * @returns Comparison result
 */
export function compareImages(
  actual: Buffer,
  expected: Buffer,
  options: ComparisonOptions = {},
): ComparisonResult {
  const { threshold = 0.1, includeAA = true } = options;

  const actualPng = PNG.sync.read(actual);
  const expectedPng = PNG.sync.read(expected);

  // Check dimensions match
  if (actualPng.width !== expectedPng.width || actualPng.height !== expectedPng.height) {
    const totalPixels = Math.max(
      actualPng.width * actualPng.height,
      expectedPng.width * expectedPng.height,
    );
    return {
      match: false,
      diffPixels: totalPixels,
      totalPixels,
      diffPercentage: 100,
    };
  }

  const { width, height } = actualPng;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(actualPng.data, expectedPng.data, diffPng.data, width, height, {
    threshold,
    includeAA,
  });

  const totalPixels = width * height;
  const diffPercentage = (diffPixels / totalPixels) * 100;

  return {
    match: diffPixels === 0,
    diffPixels,
    totalPixels,
    diffPercentage,
    diffImage: diffPixels > 0 ? PNG.sync.write(diffPng) : undefined,
  };
}

/**
 * Compares an image against a snapshot.
 *
 * If UPDATE_SNAPSHOTS=true is set and the snapshot doesn't exist,
 * it will be created. If it exists and UPDATE_SNAPSHOTS=true, it will be updated.
 *
 * @param actual - Actual image buffer (PNG format)
 * @param snapshotName - Name for the snapshot file (without extension)
 * @param testFilePath - Path to the test file (used to determine snapshot location)
 * @param options - Snapshot options
 * @returns Comparison result
 * @throws Error if snapshot doesn't exist and UPDATE_SNAPSHOTS is not set
 */
export function compareSnapshot(
  actual: Buffer,
  snapshotName: string,
  testFilePath: string,
  options: SnapshotOptions = {},
): ComparisonResult {
  const {
    snapshotDir = '__snapshots__',
    diffDir = '__diffs__',
    maxDiffPercentage = 0,
    ...comparisonOptions
  } = options;

  const testDir = path.dirname(testFilePath);
  const snapshotPath = path.join(testDir, snapshotDir, `${snapshotName}.png`);
  const diffPath = path.join(testDir, diffDir, `${snapshotName}.diff.png`);
  const actualPath = path.join(testDir, diffDir, `${snapshotName}.actual.png`);

  const updateSnapshots = process.env.UPDATE_SNAPSHOTS === 'true';

  // Ensure snapshot directory exists
  const snapshotDirPath = path.dirname(snapshotPath);
  if (!fs.existsSync(snapshotDirPath)) {
    fs.mkdirSync(snapshotDirPath, { recursive: true });
  }

  // Check if snapshot exists
  if (!fs.existsSync(snapshotPath)) {
    if (updateSnapshots) {
      // Create new snapshot
      fs.writeFileSync(snapshotPath, actual);
      const actualPng = PNG.sync.read(actual);
      return {
        match: true,
        diffPixels: 0,
        totalPixels: actualPng.width * actualPng.height,
        diffPercentage: 0,
      };
    }
    throw new Error(
      `Snapshot not found: ${snapshotPath}\n` +
        'Run with UPDATE_SNAPSHOTS=true to create initial snapshots.',
    );
  }

  // Compare with existing snapshot
  const expected = fs.readFileSync(snapshotPath);
  const result = compareImages(actual, expected, comparisonOptions);

  // If match is within threshold, return success
  if (result.match || result.diffPercentage <= maxDiffPercentage) {
    return { ...result, match: true };
  }

  // Images don't match
  if (updateSnapshots) {
    // Update snapshot
    fs.writeFileSync(snapshotPath, actual);
    return {
      match: true,
      diffPixels: 0,
      totalPixels: result.totalPixels,
      diffPercentage: 0,
    };
  }

  // Save diff and actual for debugging
  const diffDirPath = path.dirname(diffPath);
  if (!fs.existsSync(diffDirPath)) {
    fs.mkdirSync(diffDirPath, { recursive: true });
  }

  fs.writeFileSync(actualPath, actual);
  if (result.diffImage) {
    fs.writeFileSync(diffPath, result.diffImage);
  }

  return result;
}

/**
 * Helper to create a snapshot matcher for use in tests.
 *
 * @param testFilePath - Path to the test file (use import.meta.url)
 * @param options - Default snapshot options
 * @returns A function to compare images with snapshots
 *
 * @example
 * ```typescript
 * const matchSnapshot = createSnapshotMatcher(import.meta.url);
 *
 * it('should render page correctly', async () => {
 *   const png = await renderPageToPng(1);
 *   const result = matchSnapshot(png, 'page-1');
 *   expect(result.match).toBe(true);
 * });
 * ```
 */
export function createSnapshotMatcher(
  testFilePath: string,
  options: SnapshotOptions = {},
): (actual: Buffer, snapshotName: string, overrideOptions?: SnapshotOptions) => ComparisonResult {
  // Convert file:// URL to path if needed
  const filePath = testFilePath.startsWith('file://') ? fileURLToPath(testFilePath) : testFilePath;

  return (
    actual: Buffer,
    snapshotName: string,
    overrideOptions?: SnapshotOptions,
  ): ComparisonResult => {
    return compareSnapshot(actual, snapshotName, filePath, { ...options, ...overrideOptions });
  };
}

/**
 * Cleans up diff directory.
 *
 * @param testFilePath - Path to the test file
 * @param diffDir - Name of the diff directory (default: __diffs__)
 */
export function cleanupDiffs(testFilePath: string, diffDir: string = '__diffs__'): void {
  const filePath = testFilePath.startsWith('file://') ? fileURLToPath(testFilePath) : testFilePath;

  const testDir = path.dirname(filePath);
  const diffDirPath = path.join(testDir, diffDir);

  if (fs.existsSync(diffDirPath)) {
    fs.rmSync(diffDirPath, { recursive: true });
  }
}
