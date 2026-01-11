/**
 * Non-embedded font rendering tests.
 *
 * These tests verify the behavior when PDFs use fonts that are NOT embedded.
 * In PDFium WASM environment, system fonts are not accessible, so CJK characters
 * will NOT render correctly (they will be missing or show as empty space).
 *
 * This is a known limitation documented here:
 * - PDFium WASM cannot access system fonts
 * - CJK characters require embedded fonts to render correctly
 *
 * These tests serve as regression tests to document this behavior and
 * alert developers when PDFs with non-embedded fonts are encountered.
 *
 * @module non-embedded-font.test
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
  console.warn('PDFium or sharp not available - skipping non-embedded font tests:', error);
}

const describeWithPdfium: typeof describe = pdfiumAvailable ? describe : describe.skip;

// Path to test fixtures
const FIXTURES_DIR = path.join(import.meta.dirname, '../fixtures/pdfs/unicode-charts');

// Create snapshot matcher
const matchSnapshot = createSnapshotMatcher(import.meta.url, {
  threshold: 0.1,
  maxDiffPercentage: 1,
});

/**
 * Test a single PDF page and match against snapshot
 */
async function testPdfPage(pdfPath: string, snapshotName: string) {
  const pdf = await openPdf(pdfPath);

  try {
    expect(pdf.pageCount).toBeGreaterThan(0);

    const page = await pdf.renderPage(1, { format: 'png', scale: 1.5 });
    const result = matchSnapshot(page.buffer, snapshotName);

    expect(result.match, `Diff: ${result.diffPercentage.toFixed(2)}%`).toBe(true);

    return page;
  } finally {
    await pdf.close();
  }
}

describeWithPdfium('Non-embedded Font Tests (CJK Tofu Issue)', () => {
  beforeAll(() => {
    cleanupDiffs(import.meta.url);
  });

  afterAll(() => {
    // Diff files are kept on failure for debugging
  });

  describe('CJK Unified Ideographs (without embedded fonts)', () => {
    it('cjk-unified-basic-nonembed.pdf - CJK basic characters (U+4E00-U+9FFF)', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'cjk-unified-basic-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-cjk-unified-basic');
    });

    it('cjk-ext-a-nonembed.pdf - CJK Extension A (U+3400-U+4DBF)', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'cjk-ext-a-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-cjk-ext-a');
    });

    it('cjk-ext-b-nonembed.pdf - CJK Extension B (U+20000-U+2A6DF)', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'cjk-ext-b-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-cjk-ext-b');
    });
  });

  describe('Japanese Scripts (without embedded fonts)', () => {
    it('hiragana-nonembed.pdf - Hiragana (U+3040-U+309F)', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'hiragana-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-hiragana');
    });

    it('katakana-nonembed.pdf - Katakana (U+30A0-U+30FF)', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'katakana-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-katakana');
    });

    it('mixed-cjk-japanese-nonembed.pdf - Mixed Japanese content', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'mixed-cjk-japanese-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-mixed-japanese');
    });
  });

  describe('Korean Scripts (without embedded fonts)', () => {
    it('hangul-syllables-nonembed.pdf - Hangul Syllables (U+AC00-U+D7AF)', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'hangul-syllables-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-hangul-syllables');
    });
  });

  describe('Chinese Scripts (without embedded fonts)', () => {
    it('mixed-cjk-chinese-nonembed.pdf - Mixed Chinese content', async () => {
      const pdfPath = path.join(FIXTURES_DIR, 'mixed-cjk-chinese-nonembed.pdf');
      await testPdfPage(pdfPath, 'nonembed-mixed-chinese');
    });
  });
});
