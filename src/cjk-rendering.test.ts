/**
 * CJK (Chinese, Japanese, Korean) PDF rendering tests.
 *
 * These tests verify that PDFs containing CJK characters are rendered correctly.
 * The tests cover various font types including TrueType, OpenType, and CID fonts.
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

describeWithPdfium('CJK Rendering Tests', () => {
  beforeAll(() => {
    cleanupDiffs(import.meta.url);
  });

  afterAll(() => {
    // Diff files are kept on failure for debugging
  });

  describe('Japanese PDFs', () => {
    describe('SFAA_Japanese.pdf - Japanese document with embedded fonts', () => {
      it('should render first page correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'jp/SFAA_Japanese.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'jp-sfaa-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });

    describe('ichiji.pdf - Japanese form document', () => {
      it('should render first page correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'jp/ichiji.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'jp-ichiji-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });

    describe('TaroUTR50SortedList112.pdf - Japanese vertical text', () => {
      it('should render first page with vertical text correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'jp/TaroUTR50SortedList112.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'jp-taro-utr50-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });

    describe('cid_cff.pdf - CID-keyed CFF font', () => {
      it('should render CID-keyed CFF font correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'jp/cid_cff.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'jp-cid-cff-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });

    describe('arial_unicode_ab_cidfont.pdf - Arial Unicode CID font', () => {
      it('should render Arial Unicode CID font correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'jp/arial_unicode_ab_cidfont.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'jp-arial-unicode-cid-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });
  });

  describe('Chinese PDFs', () => {
    describe('ap-chinese.pdf - AP Chinese exam with simplified/traditional characters', () => {
      it('should render first page correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'cn/ap-chinese.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'cn-ap-chinese-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });

      it('should render a page with Chinese characters', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'cn/ap-chinese.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          // Page 3 typically has Chinese content
          if (pdf.pageCount >= 3) {
            const page = await pdf.renderPage(3, { format: 'png', scale: 1.0 });
            const result = matchSnapshot(page.buffer, 'cn-ap-chinese-page-3');

            expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
          }
        } finally {
          await pdf.close();
        }
      });
    });
  });

  describe('Korean PDFs', () => {
    describe('eps-hangul.pdf - Korean Hangul document', () => {
      it('should render first page correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'kr/eps-hangul.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'kr-eps-hangul-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });

    describe('hangul-practice-worksheet.pdf - Korean practice worksheet', () => {
      it('should render first page correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'kr/hangul-practice-worksheet.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'kr-hangul-worksheet-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });
  });

  describe('CID and Unicode font PDFs', () => {
    describe('ArabicCIDTrueType.pdf - Arabic CID TrueType', () => {
      it('should render Arabic CID TrueType correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'ArabicCIDTrueType.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'arabic-cid-truetype-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
    });

    describe('pdf20-utf8-test.pdf - PDF 2.0 UTF-8 test', () => {
      it('should render UTF-8 encoded text correctly', async () => {
        const pdfPath = path.join(FIXTURES_DIR, 'pdf20-utf8-test.pdf');
        const pdf = await openPdf(pdfPath);

        try {
          const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
          const result = matchSnapshot(page.buffer, 'pdf20-utf8-test-page-1');

          expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);
        } finally {
          await pdf.close();
        }
      });
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

  describe('CJK PDF page count verification', () => {
    it('should correctly count pages in Japanese PDFs', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'jp/SFAA_Japanese.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        expect(pdf.pageCount).toBeGreaterThan(0);
      } finally {
        await pdf.close();
      }
    });

    it('should correctly count pages in Chinese PDFs', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'cn/ap-chinese.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        expect(pdf.pageCount).toBeGreaterThan(0);
      } finally {
        await pdf.close();
      }
    });

    it('should correctly count pages in Korean PDFs', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'kr/eps-hangul.pdf');
      const pdf = await openPdf(pdfPath);

      try {
        expect(pdf.pageCount).toBeGreaterThan(0);
      } finally {
        await pdf.close();
      }
    });
  });
});
