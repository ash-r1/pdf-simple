/**
 * Pixel comparison tests for PDF rendering.
 *
 * These tests verify that PDF pages are rendered correctly by comparing
 * the output against known-good snapshots.
 *
 * To update snapshots when rendering changes intentionally:
 *   UPDATE_SNAPSHOTS=true pnpm test pixel-comparison
 *
 * @module pixel-comparison.test
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { openPdf } from './index.js';
import type { ComparisonResult, SnapshotOptions } from './test-utils/image-comparison.js';
import { cleanupDiffs, createSnapshotMatcher } from './test-utils/image-comparison.js';

const currentDir: string = path.dirname(fileURLToPath(import.meta.url));

// Check if PDFium and sharp are available
let pdfiumAvailable = false;
try {
  const { PDFiumLibrary } = await import('@hyzyla/pdfium');
  await import('sharp');
  await PDFiumLibrary.init();
  pdfiumAvailable = true;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn('PDFium or sharp not available - skipping pixel comparison tests:', message);
}

const describeWithPdfium: typeof describe = pdfiumAvailable ? describe : describe.skip;

// Path to test fixtures
const FIXTURES_DIR: string = path.join(currentDir, '../fixtures/pdfs');

// Create snapshot matcher
const matchSnapshot: (
  actual: Buffer,
  snapshotName: string,
  overrideOptions?: SnapshotOptions,
) => ComparisonResult = createSnapshotMatcher(import.meta.url, {
  threshold: 0.1,
  maxDiffPercentage: 0, // Exact match required
});

describeWithPdfium('Pixel Comparison Tests', () => {
  beforeAll(() => {
    // Clean up any previous diff files
    cleanupDiffs(import.meta.url);
  });

  describe('simple-text.pdf', () => {
    it('should render page 1 correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'simple-text.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
        const result = matchSnapshot(page.buffer, 'simple-text/page-1');

        expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
      } finally {
        await pdf.close();
      }
    });

    it('should render page 1 at 2x scale correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'simple-text.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        const page = await pdf.renderPage(1, { format: 'png', scale: 2.0 });
        const result = matchSnapshot(page.buffer, 'simple-text/page-1-2x');

        expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('shapes.pdf', () => {
    it('should render colored shapes correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'shapes.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
        const result = matchSnapshot(page.buffer, 'shapes/page-1');

        expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('multi-page.pdf', () => {
    it('should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'multi-page.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        expect(pdf.pageCount).toBe(3);

        for (let pageNum = 1; pageNum <= pdf.pageCount; pageNum++) {
          const page = await pdf.renderPage(pageNum, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, `multi-page/page-${pageNum}`);

          expect(result.match, `Page ${pageNum} diff: ${result.diffPercentage.toFixed(2)}%`).toBe(
            true,
          );
        }
      } finally {
        await pdf.close();
      }
    });
  });

  describe('gradient.pdf', () => {
    it('should render gradient correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'gradient.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
        const result = matchSnapshot(page.buffer, 'gradient/page-1');

        expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('render consistency', () => {
    it('should produce identical output for same PDF rendered twice', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'shapes.pdf');

      // First render
      const pdf1 = await openPdf(pdfPath);
      const page1 = await pdf1.renderPage(1, { format: 'png', scale: 1.0 });
      await pdf1.close();

      // Second render
      const pdf2 = await openPdf(pdfPath);
      const page2 = await pdf2.renderPage(1, { format: 'png', scale: 1.0 });
      await pdf2.close();

      // Compare the two renders
      const { compareImages } = await import('./test-utils/image-comparison.js');
      const result = compareImages(page1.buffer, page2.buffer);

      expect(result.match).toBe(true);
      expect(result.diffPixels).toBe(0);
    });
  });
});

describeWithPdfium('Image Comparison Utility', () => {
  it('should detect differences between images', async () => {
    const { compareImages } = await import('./test-utils/image-comparison.js');
    const { PNG } = await import('pngjs');

    // Create two slightly different images
    const width = 100;
    const height = 100;

    const png1 = new PNG({ width, height });
    const png2 = new PNG({ width, height });

    // Fill with white
    for (let i = 0; i < width * height * 4; i += 4) {
      png1.data[i] = 255;
      png1.data[i + 1] = 255;
      png1.data[i + 2] = 255;
      png1.data[i + 3] = 255;

      png2.data[i] = 255;
      png2.data[i + 1] = 255;
      png2.data[i + 2] = 255;
      png2.data[i + 3] = 255;
    }

    // Add a red pixel to png2
    png2.data[0] = 255;
    png2.data[1] = 0;
    png2.data[2] = 0;

    const buffer1 = PNG.sync.write(png1);
    const buffer2 = PNG.sync.write(png2);

    const result = compareImages(buffer1, buffer2);

    expect(result.match).toBe(false);
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(result.diffPercentage).toBeGreaterThan(0);
  });

  it('should match identical images', async () => {
    const { compareImages } = await import('./test-utils/image-comparison.js');
    const { PNG } = await import('pngjs');

    const width = 100;
    const height = 100;

    const png = new PNG({ width, height });

    // Fill with solid color
    for (let i = 0; i < width * height * 4; i += 4) {
      png.data[i] = 128;
      png.data[i + 1] = 64;
      png.data[i + 2] = 32;
      png.data[i + 3] = 255;
    }

    const buffer = PNG.sync.write(png);

    const result = compareImages(buffer, buffer);

    expect(result.match).toBe(true);
    expect(result.diffPixels).toBe(0);
    expect(result.diffPercentage).toBe(0);
  });

  it('should detect dimension mismatch', async () => {
    const { compareImages } = await import('./test-utils/image-comparison.js');
    const { PNG } = await import('pngjs');

    const png1 = new PNG({ width: 100, height: 100 });
    const png2 = new PNG({ width: 200, height: 200 });

    // Fill with white
    for (let i = 0; i < png1.data.length; i += 4) {
      png1.data[i] = 255;
      png1.data[i + 1] = 255;
      png1.data[i + 2] = 255;
      png1.data[i + 3] = 255;
    }

    for (let i = 0; i < png2.data.length; i += 4) {
      png2.data[i] = 255;
      png2.data[i + 1] = 255;
      png2.data[i + 2] = 255;
      png2.data[i + 3] = 255;
    }

    const buffer1 = PNG.sync.write(png1);
    const buffer2 = PNG.sync.write(png2);

    const result = compareImages(buffer1, buffer2);

    expect(result.match).toBe(false);
    expect(result.diffPercentage).toBe(100);
  });
});
