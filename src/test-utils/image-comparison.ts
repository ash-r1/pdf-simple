import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Result of image comparison
 */
export interface ImageComparisonResult {
  /** Whether images match within threshold */
  match: boolean;
  /** Number of different pixels */
  diffPixels: number;
  /** Total number of pixels */
  totalPixels: number;
  /** Percentage of different pixels (0-100) */
  diffPercentage: number;
  /** Path to diff image if generated */
  diffImagePath?: string;
}

/**
 * Options for image comparison
 */
export interface ImageComparisonOptions {
  /** Threshold for pixel difference (0-1, default: 0.1) */
  threshold?: number;
  /** Whether to generate diff image on mismatch */
  generateDiff?: boolean;
  /** Directory to save diff images */
  diffOutputDir?: string;
  /** Maximum allowed difference percentage (0-100, default: 1) */
  maxDiffPercentage?: number;
}

/**
 * Compare two PNG images and return the result
 */
export function compareImages(
  actualBuffer: Buffer,
  expectedBuffer: Buffer,
  options: ImageComparisonOptions = {},
): ImageComparisonResult {
  const { threshold = 0.1, generateDiff = false, maxDiffPercentage = 1 } = options;

  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(expectedBuffer);

  // Check dimensions
  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      match: false,
      diffPixels: actual.width * actual.height,
      totalPixels: actual.width * actual.height,
      diffPercentage: 100,
    };
  }

  const diff = generateDiff ? new PNG({ width: actual.width, height: actual.height }) : undefined;

  const diffPixels = pixelmatch(
    actual.data,
    expected.data,
    diff?.data,
    actual.width,
    actual.height,
    { threshold },
  );

  const totalPixels = actual.width * actual.height;
  const diffPercentage = (diffPixels / totalPixels) * 100;
  const match = diffPercentage <= maxDiffPercentage;

  return {
    match,
    diffPixels,
    totalPixels,
    diffPercentage,
  };
}

/**
 * Get the path to a snapshot file
 */
export function getSnapshotPath(snapshotDir: string, testName: string, pageNumber: number): string {
  return join(snapshotDir, `${testName}-page${pageNumber}.png`);
}

/**
 * Save a snapshot image
 */
export function saveSnapshot(snapshotPath: string, imageBuffer: Buffer): void {
  const dir = dirname(snapshotPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(snapshotPath, imageBuffer);
}

/**
 * Load a snapshot image
 */
export function loadSnapshot(snapshotPath: string): Buffer | null {
  if (!existsSync(snapshotPath)) {
    return null;
  }
  return readFileSync(snapshotPath);
}

/**
 * Update mode check - when UPDATE_SNAPSHOTS env is set
 */
export function isUpdateMode(): boolean {
  return process.env.UPDATE_SNAPSHOTS === 'true' || process.env.UPDATE_SNAPSHOTS === '1';
}
