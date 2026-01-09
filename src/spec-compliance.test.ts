/**
 * PDF Specification Compliance Tests
 *
 * This test suite validates that pdf-simple can correctly handle PDFs from
 * official specification bodies and industry standards:
 *
 * 1. veraPDF corpus - ISO 19005 (PDF/A) and ISO 14289 (PDF/UA) test files
 *    https://github.com/veraPDF/veraPDF-corpus
 *
 * 2. BFO PDF/A-2 Test Suite - PDF/A-2 conformance test files
 *    https://github.com/bfocom/pdfa-testsuite
 *
 * 3. PDF/UA Reference Suite - PDF Universal Accessibility test files
 *    https://pdfa.org/resource/pdfua-reference-suite/
 *
 * Standards covered:
 * - ISO 32000-1 (PDF 1.7)
 * - ISO 32000-2 (PDF 2.0)
 * - ISO 19005-1/2/3 (PDF/A-1, PDF/A-2, PDF/A-3)
 * - ISO 14289-1 (PDF/UA-1)
 */

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  compareImages,
  getSnapshotPath,
  isUpdateMode,
  loadSnapshot,
  saveSnapshot,
} from './test-utils/image-comparison.js';

// Check if canvas is available
let canvasAvailable = false;
try {
  await import('canvas');
  canvasAvailable = true;
} catch {
  console.warn('Canvas not available - skipping spec compliance tests');
}

const currentFilePath: string = fileURLToPath(import.meta.url);
const currentDirPath: string = dirname(currentFilePath);

// Fixture directories
const FIXTURES_DIR: string = join(currentDirPath, '..', 'fixtures', 'pdfs');
const SNAPSHOTS_DIR: string = join(currentDirPath, '..', 'fixtures', 'snapshots');

type DescribeFn = typeof describe;
const describeWithCanvas: DescribeFn = canvasAvailable ? describe : describe.skip;

/**
 * PDF test file metadata
 */
interface PdfTestFile {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** Source (verapdf-corpus, bfo-testsuite, pdfua) */
  source: string;
  /** Expected to pass or fail (based on filename) */
  expectedResult: 'pass' | 'fail';
  /** PDF version if known */
  pdfVersion?: string;
  /** Number of pages if known */
  pageCount?: number;
}

/**
 * Collect all PDF test files from fixtures directory
 */
function collectPdfTestFiles(): PdfTestFile[] {
  const files: PdfTestFile[] = [];

  const sources = ['verapdf-corpus', 'bfo-testsuite', 'pdfua'];

  for (const source of sources) {
    const sourceDir = join(FIXTURES_DIR, source);
    if (!existsSync(sourceDir)) {
      continue;
    }

    const pdfFiles = readdirSync(sourceDir).filter((f) => f.endsWith('.pdf'));

    for (const pdfFile of pdfFiles) {
      const expectedResult = pdfFile.includes('-pass') ? 'pass' : 'fail';
      files.push({
        path: join(sourceDir, pdfFile),
        name: basename(pdfFile, '.pdf'),
        source,
        expectedResult,
      });
    }
  }

  return files;
}

describeWithCanvas('PDF Specification Compliance Tests', () => {
  const testFiles = collectPdfTestFiles();

  if (testFiles.length === 0) {
    it.skip('No PDF test files found in fixtures directory', () => {
      // Placeholder for skipped test
    });
    return;
  }

  describe('veraPDF Corpus - ISO 19005 (PDF/A)', () => {
    const verapdfFiles = testFiles.filter((f) => f.source === 'verapdf-corpus');

    if (verapdfFiles.length === 0) {
      it.skip('No veraPDF corpus files found', () => {
        // Placeholder for skipped test
      });
      return;
    }

    describe('File Structure Tests (6.1)', () => {
      const fileStructureFiles = verapdfFiles.filter((f) => f.name.startsWith('6-1'));

      for (const file of fileStructureFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBeGreaterThan(0);

          // Render first page
          const page = await pdf.renderPage(1, { format: 'png' });
          expect(page.buffer).toBeInstanceOf(Buffer);
          expect(page.width).toBeGreaterThan(0);
          expect(page.height).toBeGreaterThan(0);

          // Check PNG magic bytes
          expect(page.buffer[0]).toBe(0x89);
          expect(page.buffer[1]).toBe(0x50);
          expect(page.buffer[2]).toBe(0x4e);
          expect(page.buffer[3]).toBe(0x47);

          await pdf.close();
        });
      }
    });

    describe('Font Tests (6.3)', () => {
      const fontFiles = verapdfFiles.filter((f) => f.name.startsWith('6-3'));

      for (const file of fontFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBeGreaterThan(0);

          // Render first page
          const page = await pdf.renderPage(1, { format: 'png' });
          expect(page.buffer).toBeInstanceOf(Buffer);

          await pdf.close();
        });
      }
    });
  });

  describe('BFO PDF/A-2 Test Suite', () => {
    const bfoFiles = testFiles.filter((f) => f.source === 'bfo-testsuite');

    if (bfoFiles.length === 0) {
      it.skip('No BFO test suite files found', () => {
        // Placeholder for skipped test
      });
      return;
    }

    describe('Document Information (6.1)', () => {
      const docInfoFiles = bfoFiles.filter((f) => f.name.includes('6-1'));

      for (const file of docInfoFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBe(1);

          const page = await pdf.renderPage(1, { format: 'png' });
          expect(page.buffer).toBeInstanceOf(Buffer);

          await pdf.close();
        });
      }
    });

    describe('Graphics (6.2)', () => {
      const graphicsFiles = bfoFiles.filter((f) => f.name.includes('6-2'));

      for (const file of graphicsFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBeGreaterThan(0);

          const page = await pdf.renderPage(1, { format: 'png' });
          expect(page.buffer).toBeInstanceOf(Buffer);

          await pdf.close();
        });
      }
    });

    describe('Annotations (6.3)', () => {
      const annotationFiles = bfoFiles.filter((f) => f.name.includes('6-3'));

      for (const file of annotationFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBe(1);

          const page = await pdf.renderPage(1, { format: 'png' });
          expect(page.buffer).toBeInstanceOf(Buffer);

          await pdf.close();
        });
      }
    });

    describe('Metadata (6.8)', () => {
      const metadataFiles = bfoFiles.filter((f) => f.name.includes('6-8'));

      for (const file of metadataFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBe(1);

          const page = await pdf.renderPage(1, { format: 'png' });
          expect(page.buffer).toBeInstanceOf(Buffer);

          await pdf.close();
        });
      }
    });
  });

  describe('PDF/UA-1 (ISO 14289-1) - Accessibility', () => {
    const pdfuaFiles = testFiles.filter((f) => f.source === 'pdfua');

    if (pdfuaFiles.length === 0) {
      it.skip('No PDF/UA files found', () => {
        // Placeholder for skipped test
      });
      return;
    }

    describe('General Requirements (7.1)', () => {
      for (const file of pdfuaFiles) {
        it(`should render ${file.name} correctly`, async () => {
          const { openPdf } = await import('./index.js');
          const pdf = await openPdf(file.path);

          expect(pdf.pageCount).toBeGreaterThan(0);

          // Render all pages
          for await (const page of pdf.renderPages({ format: 'png' })) {
            expect(page.buffer).toBeInstanceOf(Buffer);
            expect(page.width).toBeGreaterThan(0);
            expect(page.height).toBeGreaterThan(0);
          }

          await pdf.close();
        });
      }
    });
  });
});

describeWithCanvas('Visual Regression Tests', () => {
  const testFiles = collectPdfTestFiles();

  // Only run visual tests on pass files (known good PDFs)
  const passFiles = testFiles.filter((f) => f.expectedResult === 'pass');

  if (passFiles.length === 0) {
    it.skip('No pass files found for visual regression testing', () => {
      // Placeholder for skipped test
    });
    return;
  }

  beforeAll(() => {
    if (isUpdateMode()) {
      console.log('UPDATE_SNAPSHOTS mode enabled - will update snapshot files');
    }
  });

  for (const file of passFiles) {
    describe(`${file.source}/${file.name}`, () => {
      it('should match visual snapshot', async () => {
        const { openPdf } = await import('./index.js');
        const pdf = await openPdf(file.path);

        const snapshotPath = getSnapshotPath(join(SNAPSHOTS_DIR, file.source), file.name, 1);

        const page = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
        const existingSnapshot = loadSnapshot(snapshotPath);

        if (isUpdateMode()) {
          // Update mode: save/overwrite snapshot
          saveSnapshot(snapshotPath, page.buffer);
          console.log(`Saved snapshot: ${snapshotPath}`);
        } else if (!existingSnapshot) {
          // No snapshot exists and not in update mode - fail with instructions
          await pdf.close();
          throw new Error(
            `Snapshot not found: ${snapshotPath}\n` +
              'Run with UPDATE_SNAPSHOTS=true to generate initial snapshots:\n' +
              '  UPDATE_SNAPSHOTS=true pnpm test',
          );
        } else {
          // Compare with existing snapshot
          const result = compareImages(page.buffer, existingSnapshot, {
            threshold: 0.1,
            maxDiffPercentage: 1,
          });

          if (!result.match) {
            console.error(
              `Visual mismatch for ${file.name}: ${result.diffPercentage.toFixed(2)}% different (${result.diffPixels} pixels)`,
            );
          }
          expect(result.match).toBe(true);
        }

        await pdf.close();
      });
    });
  }
});

describeWithCanvas('Multi-page Rendering Tests', () => {
  const testFiles = collectPdfTestFiles();
  const multiPageFiles = testFiles.filter((f) => f.source === 'pdfua' || f.name.includes('6-1-3'));

  if (multiPageFiles.length === 0) {
    it.skip('No multi-page files found', () => {
      // Placeholder for skipped test
    });
    return;
  }

  for (const file of multiPageFiles) {
    it(`should render all pages of ${file.name}`, async () => {
      const { openPdf } = await import('./index.js');
      const pdf = await openPdf(file.path);
      const pageCount = pdf.pageCount;

      expect(pageCount).toBeGreaterThan(0);

      const pages: number[] = [];
      for await (const page of pdf.renderPages({ format: 'png' })) {
        pages.push(page.pageNumber);
        expect(page.buffer).toBeInstanceOf(Buffer);

        // Verify PNG format
        expect(page.buffer[0]).toBe(0x89);
        expect(page.buffer[1]).toBe(0x50);
      }

      expect(pages).toHaveLength(pageCount);
      expect(pages).toEqual(Array.from({ length: pageCount }, (_, i) => i + 1));

      await pdf.close();
    });
  }
});

describeWithCanvas('Image Format Tests', () => {
  const testFiles = collectPdfTestFiles();
  const sampleFile = testFiles.find((f) => f.expectedResult === 'pass');

  if (!sampleFile) {
    it.skip('No sample file found for format tests', () => {
      // Placeholder for skipped test
    });
    return;
  }

  it('should render to JPEG format', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(sampleFile.path);

    const page = await pdf.renderPage(1, { format: 'jpeg', quality: 0.9 });

    // Check JPEG magic bytes
    expect(page.buffer[0]).toBe(0xff);
    expect(page.buffer[1]).toBe(0xd8);

    await pdf.close();
  });

  it('should render to PNG format', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(sampleFile.path);

    const page = await pdf.renderPage(1, { format: 'png' });

    // Check PNG magic bytes
    expect(page.buffer[0]).toBe(0x89);
    expect(page.buffer[1]).toBe(0x50);
    expect(page.buffer[2]).toBe(0x4e);
    expect(page.buffer[3]).toBe(0x47);

    await pdf.close();
  });

  it('should respect scale option', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(sampleFile.path);

    const page1 = await pdf.renderPage(1, { format: 'png', scale: 1.0 });
    const page2 = await pdf.renderPage(1, { format: 'png', scale: 2.0 });

    expect(page2.width).toBeCloseTo(page1.width * 2, -1);
    expect(page2.height).toBeCloseTo(page1.height * 2, -1);

    await pdf.close();
  });
});
