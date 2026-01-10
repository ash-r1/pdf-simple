/**
 * CJK (Chinese, Japanese, Korean) PDF rendering tests.
 *
 * These tests verify that PDFs containing CJK characters are rendered correctly.
 * The tests cover various font types including TrueType, OpenType, and CID fonts.
 * All pages of each PDF are tested.
 *
 * To update snapshots when rendering changes intentionally:
 *   UPDATE_SNAPSHOTS=true pnpm test cjk-rendering
 *
 * @module cjk-rendering.test
 */

import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openPdf } from './index.js';
import { cleanupDiffs, createSnapshotMatcher } from './test-utils/image-comparison.js';

// Check if PDFium and sharp are available
let pdfiumAvailable = false;
try {
  const { PDFiumLibrary } = await import('@hyzyla/pdfium');
  await import('sharp');
  await PDFiumLibrary.init();
  pdfiumAvailable = true;
} catch (error) {
  console.warn('PDFium or sharp not available - skipping CJK rendering tests:', error);
}

const describeWithPdfium: typeof describe = pdfiumAvailable ? describe : describe.skip;

// Path to test fixtures
const FIXTURES_DIR = path.join(import.meta.dirname, '../fixtures/pdfs');

// Create snapshot matcher with slightly higher tolerance for CJK fonts
// (different systems may render CJK fonts slightly differently)
const matchSnapshot = createSnapshotMatcher(import.meta.url, {
  threshold: 0.1,
  maxDiffPercentage: 1, // Allow 1% difference for cross-platform font rendering
});

/**
 * Helper function to test all pages of a PDF
 */
async function testAllPages(pdfPath: string, snapshotPrefix: string, maxPages?: number) {
  const pdf = await openPdf(pdfPath);

  try {
    const totalPages = pdf.pageCount;
    expect(totalPages).toBeGreaterThan(0);

    const pageCount = maxPages ? Math.min(totalPages, maxPages) : totalPages;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.renderPage(pageNum, { format: 'png', scale: 1.0 });
      const result = matchSnapshot(page.buffer, `${snapshotPrefix}-page-${pageNum}`);

      expect(
        result.match,
        `Page ${pageNum}/${pageCount} diff: ${result.diffPercentage.toFixed(2)}%`,
      ).toBe(true);
    }

    return pageCount;
  } finally {
    await pdf.close();
  }
}

describeWithPdfium('CJK Rendering Tests', () => {
  beforeAll(() => {
    cleanupDiffs(import.meta.url);
  });

  afterAll(() => {
    // Diff files are kept on failure for debugging
  });

  describe('Japanese PDFs', () => {
    it('SFAA_Japanese.pdf - should render first 5 pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/SFAA_Japanese.pdf');
      const pageCount = await testAllPages(pdfPath, 'jp-sfaa', 5);
      expect(pageCount).toBe(5);
    });

    it('ichiji.pdf - should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/ichiji.pdf');
      const pageCount = await testAllPages(pdfPath, 'jp-ichiji');
      expect(pageCount).toBeGreaterThan(0);
    });

    it('TaroUTR50SortedList112.pdf - should render all pages with vertical text correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/TaroUTR50SortedList112.pdf');
      const pageCount = await testAllPages(pdfPath, 'jp-taro-utr50');
      expect(pageCount).toBeGreaterThan(0);
    });

    it('cid_cff.pdf - should render all pages with CID-keyed CFF font correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/cid_cff.pdf');
      const pageCount = await testAllPages(pdfPath, 'jp-cid-cff');
      expect(pageCount).toBeGreaterThan(0);
    });

    it('arial_unicode_ab_cidfont.pdf - should render all pages with Arial Unicode CID font correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/arial_unicode_ab_cidfont.pdf');
      const pageCount = await testAllPages(pdfPath, 'jp-arial-unicode-cid');
      expect(pageCount).toBeGreaterThan(0);
    });
  });

  describe('Chinese PDFs', () => {
    it('ap-chinese.pdf - should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'cn/ap-chinese.pdf');
      const pageCount = await testAllPages(pdfPath, 'cn-ap-chinese');
      expect(pageCount).toBeGreaterThan(0);
    });
  });

  describe('Korean PDFs', () => {
    it('eps-hangul.pdf - should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'kr/eps-hangul.pdf');
      const pageCount = await testAllPages(pdfPath, 'kr-eps-hangul');
      expect(pageCount).toBeGreaterThan(0);
    });

    it('hangul-practice-worksheet.pdf - should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'kr/hangul-practice-worksheet.pdf');
      const pageCount = await testAllPages(pdfPath, 'kr-hangul-worksheet');
      expect(pageCount).toBeGreaterThan(0);
    });
  });

  describe('CID and Unicode font PDFs', () => {
    it('ArabicCIDTrueType.pdf - should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'ArabicCIDTrueType.pdf');
      const pageCount = await testAllPages(pdfPath, 'arabic-cid-truetype');
      expect(pageCount).toBeGreaterThan(0);
    });

    it('pdf20-utf8-test.pdf - should render all pages correctly', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'pdf20-utf8-test.pdf');
      const pageCount = await testAllPages(pdfPath, 'pdf20-utf8-test');
      expect(pageCount).toBeGreaterThan(0);
    });
  });

  describe('CJK rendering consistency', () => {
    it('should produce identical output for same Japanese PDF rendered twice', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/ichiji.pdf');

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

    it('should produce identical output for same Chinese PDF rendered twice', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'cn/ap-chinese.pdf');

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

    it('should produce identical output for same Korean PDF rendered twice', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'kr/eps-hangul.pdf');

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
