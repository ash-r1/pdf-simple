import { PDFDocument, rgb } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

// Check if PDFium and sharp are available before running tests
let pdfiumAvailable = false;
try {
  // Try to import PDFium and sharp to check if they work
  const { PDFiumLibrary } = await import('@hyzyla/pdfium');
  await import('sharp');
  await PDFiumLibrary.init();
  pdfiumAvailable = true;
} catch (error) {
  console.warn('PDFium or sharp not available - skipping rendering tests:', error);
}

// Only run tests if PDFium is available
const describeWithPdfium: typeof describe = pdfiumAvailable ? describe : describe.skip;

// Generate test PDFs
let singlePagePdf: Uint8Array;
let multiPagePdf: Uint8Array;

beforeAll(async () => {
  // Create a single page PDF
  const doc1 = await PDFDocument.create();
  const page1 = doc1.addPage([612, 792]); // Letter size
  page1.drawText('Hello, World!', {
    x: 50,
    y: 700,
    size: 30,
  });
  singlePagePdf = await doc1.save();

  // Create a multi-page PDF
  const doc2 = await PDFDocument.create();
  for (let i = 1; i <= 5; i++) {
    const page = doc2.addPage([612, 792]);
    page.drawText(`Page ${i}`, {
      x: 50,
      y: 700,
      size: 30,
    });
    page.drawRectangle({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      color: rgb(i * 0.2, 0.5, 1 - i * 0.1),
    });
  }
  multiPagePdf = await doc2.save();
});

describeWithPdfium('openPdf', () => {
  it('should open a PDF from Uint8Array', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);
    expect(pdf.pageCount).toBe(1);
    await pdf.close();
  });

  it('should open a PDF from Buffer', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(Buffer.from(singlePagePdf));
    expect(pdf.pageCount).toBe(1);
    await pdf.close();
  });

  it('should open a PDF from ArrayBuffer', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf.buffer);
    expect(pdf.pageCount).toBe(1);
    await pdf.close();
  });

  it('should throw FILE_NOT_FOUND for non-existent file', async () => {
    const { openPdf, PdfError } = await import('./index.js');
    await expect(openPdf('/non/existent/file.pdf')).rejects.toThrow(PdfError);
    await expect(openPdf('/non/existent/file.pdf')).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
  });

  it('should throw INVALID_PDF for invalid data', async () => {
    const { openPdf, PdfError } = await import('./index.js');
    const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);
    await expect(openPdf(invalidData)).rejects.toThrow(PdfError);
    await expect(openPdf(invalidData)).rejects.toMatchObject({
      code: 'INVALID_PDF',
    });
  });
});

describeWithPdfium('pageCount', () => {
  it('should return correct page count for single page PDF', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);
    expect(pdf.pageCount).toBe(1);
    await pdf.close();
  });

  it('should return correct page count for multi-page PDF', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(multiPagePdf);
    expect(pdf.pageCount).toBe(5);
    await pdf.close();
  });
});

describeWithPdfium('renderPage', () => {
  it('should render a single page to JPEG', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);
    const page = await pdf.renderPage(1);

    expect(page.pageNumber).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.buffer).toBeInstanceOf(Buffer);
    expect(page.width).toBeGreaterThan(0);
    expect(page.height).toBeGreaterThan(0);

    // Check JPEG magic bytes
    expect(page.buffer[0]).toBe(0xff);
    expect(page.buffer[1]).toBe(0xd8);

    await pdf.close();
  });

  it('should render a single page to PNG', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);
    const page = await pdf.renderPage(1, { format: 'png' });

    expect(page.buffer).toBeInstanceOf(Buffer);

    // Check PNG magic bytes
    expect(page.buffer[0]).toBe(0x89);
    expect(page.buffer[1]).toBe(0x50);
    expect(page.buffer[2]).toBe(0x4e);
    expect(page.buffer[3]).toBe(0x47);

    await pdf.close();
  });

  it('should respect scale option', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);

    const page1 = await pdf.renderPage(1, { scale: 1.0 });
    const page2 = await pdf.renderPage(1, { scale: 2.0 });

    expect(page2.width).toBeCloseTo(page1.width * 2, -1);
    expect(page2.height).toBeCloseTo(page1.height * 2, -1);

    await pdf.close();
  });

  it('should throw INVALID_PAGE_NUMBER for invalid page', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);

    await expect(pdf.renderPage(0)).rejects.toMatchObject({
      code: 'INVALID_PAGE_NUMBER',
    });
    await expect(pdf.renderPage(2)).rejects.toMatchObject({
      code: 'INVALID_PAGE_NUMBER',
    });

    await pdf.close();
  });
});

describeWithPdfium('renderPages', () => {
  it('should render all pages using async generator', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(multiPagePdf);
    const pages: { pageNumber: number; buffer: Buffer }[] = [];

    for await (const page of pdf.renderPages()) {
      pages.push({ pageNumber: page.pageNumber, buffer: page.buffer });
    }

    expect(pages).toHaveLength(5);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5]);

    // Each page should have a valid JPEG buffer
    for (const page of pages) {
      expect(page.buffer[0]).toBe(0xff);
      expect(page.buffer[1]).toBe(0xd8);
    }

    await pdf.close();
  });

  it('should render specific pages using array', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(multiPagePdf);
    const pages: number[] = [];

    for await (const page of pdf.renderPages({ pages: [1, 3, 5] })) {
      pages.push(page.pageNumber);
    }

    expect(pages).toEqual([1, 3, 5]);
    await pdf.close();
  });

  it('should render page range', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(multiPagePdf);
    const pages: number[] = [];

    for await (const page of pdf.renderPages({ pages: { start: 2, end: 4 } })) {
      pages.push(page.pageNumber);
    }

    expect(pages).toEqual([2, 3, 4]);
    await pdf.close();
  });
});

describeWithPdfium('renderPdfPages', () => {
  it('should render all pages and auto-close', async () => {
    const { renderPdfPages } = await import('./index.js');
    const pages: number[] = [];

    for await (const page of renderPdfPages(multiPagePdf)) {
      pages.push(page.pageNumber);
    }

    expect(pages).toEqual([1, 2, 3, 4, 5]);
  });
});

describeWithPdfium('getPageCount', () => {
  it('should return page count without rendering', async () => {
    const { getPageCount } = await import('./index.js');
    const count = await getPageCount(multiPagePdf);
    expect(count).toBe(5);
  });
});

describeWithPdfium('AsyncDisposable', () => {
  it('should support await using syntax', async () => {
    const { openPdf } = await import('./index.js');
    // Using manual Symbol.asyncDispose for compatibility
    const pdf = await openPdf(singlePagePdf);
    expect(pdf.pageCount).toBe(1);
    await pdf[Symbol.asyncDispose]();
  });
});

describeWithPdfium('document lifecycle', () => {
  it('should throw DOCUMENT_CLOSED after close', async () => {
    const { openPdf, PdfError } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);
    await pdf.close();

    expect(() => pdf.pageCount).toThrow(PdfError);
    expect(() => pdf.pageCount).toThrow('Document has been closed');
  });

  it('should be safe to call close multiple times', async () => {
    const { openPdf } = await import('./index.js');
    const pdf = await openPdf(singlePagePdf);
    await pdf.close();
    await pdf.close(); // Should not throw
  });
});
