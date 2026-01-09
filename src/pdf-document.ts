/**
 * PDF Document implementation using pdfjs-dist
 */

import fs from 'node:fs/promises';
import { createCanvas } from 'canvas';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
// Use legacy build for Node.js compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { DEFAULT_RENDER_OPTIONS, getCMapUrl, getStandardFontDataUrl } from './config.js';
import type {
  PageRange,
  PdfDocument,
  PdfInput,
  PdfOpenOptions,
  RenderedPage,
  RenderOptions,
} from './types.js';
import { PdfError } from './types.js';

/**
 * Internal PDF document implementation
 */
export class PdfDocumentImpl implements PdfDocument {
  private document: PDFDocumentProxy;
  private closed = false;

  private constructor(document: PDFDocumentProxy) {
    this.document = document;
  }

  /**
   * Open a PDF document from various input sources
   */
  public static async open(
    input: PdfInput,
    options: PdfOpenOptions = {},
  ): Promise<PdfDocumentImpl> {
    const data = await resolveInput(input);

    const loadingTask = pdfjsLib.getDocument({
      data,
      isEvalSupported: false,
      cMapUrl: options.cMapPath ?? getCMapUrl(),
      cMapPacked: true,
      standardFontDataUrl: options.standardFontPath ?? getStandardFontDataUrl(),
      password: options.password,
    });

    try {
      const document = await loadingTask.promise;
      return new PdfDocumentImpl(document);
    } catch (error) {
      throw wrapPdfjsError(error);
    }
  }

  public get pageCount(): number {
    this.ensureOpen();
    return this.document.numPages;
  }

  public async *renderPages(
    options: RenderOptions = {},
  ): AsyncGenerator<RenderedPage, void, unknown> {
    this.ensureOpen();

    const pageNumbers = this.resolvePageNumbers(options.pages);

    for (const pageNumber of pageNumbers) {
      yield await this.renderPageInternal(pageNumber, options);
    }
  }

  public async renderPage(
    pageNumber: number,
    options: Omit<RenderOptions, 'pages'> = {},
  ): Promise<RenderedPage> {
    this.ensureOpen();

    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new PdfError(
        `Invalid page number: ${pageNumber}. Document has ${this.pageCount} pages.`,
        'INVALID_PAGE_NUMBER',
      );
    }

    return await this.renderPageInternal(pageNumber, options);
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.document.destroy();
  }

  // AsyncDisposable implementation
  public async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new PdfError('Document has been closed', 'DOCUMENT_CLOSED');
    }
  }

  private resolvePageNumbers(pages?: number[] | PageRange): number[] {
    if (!pages) {
      // All pages
      return Array.from({ length: this.pageCount }, (_, i) => i + 1);
    }

    if (Array.isArray(pages)) {
      // Validate page numbers
      for (const p of pages) {
        if (p < 1 || p > this.pageCount) {
          throw new PdfError(
            `Invalid page number: ${p}. Document has ${this.pageCount} pages.`,
            'INVALID_PAGE_NUMBER',
          );
        }
      }
      return pages;
    }

    // PageRange
    const start = pages.start ?? 1;
    const end = pages.end ?? this.pageCount;

    if (start < 1 || start > this.pageCount) {
      throw new PdfError(
        `Invalid start page: ${start}. Document has ${this.pageCount} pages.`,
        'INVALID_PAGE_NUMBER',
      );
    }

    if (end < start || end > this.pageCount) {
      throw new PdfError(
        `Invalid end page: ${end}. Document has ${this.pageCount} pages.`,
        'INVALID_PAGE_NUMBER',
      );
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  private async renderPageInternal(
    pageNumber: number,
    options: Omit<RenderOptions, 'pages'>,
  ): Promise<RenderedPage> {
    const scale = options.scale ?? DEFAULT_RENDER_OPTIONS.scale;
    const format = options.format ?? DEFAULT_RENDER_OPTIONS.format;
    const quality = options.quality ?? DEFAULT_RENDER_OPTIONS.quality;

    let page: PDFPageProxy | null = null;

    try {
      page = await this.document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      // Create canvas for this page
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render page to canvas
      await page.render({
        // biome-ignore lint/suspicious/noExplicitAny: pdfjs-dist types are not fully compatible with canvas
        canvasContext: context as any,
        viewport,
      }).promise;

      // Convert to buffer
      const buffer =
        format === 'jpeg'
          ? canvas.toBuffer('image/jpeg', { quality })
          : canvas.toBuffer('image/png');

      return {
        pageNumber,
        totalPages: this.pageCount,
        buffer,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      };
    } catch (error) {
      throw new PdfError(
        `Failed to render page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`,
        'RENDER_FAILED',
        error,
      );
    } finally {
      // Clean up page resources
      if (page) {
        page.cleanup();
      }
    }
  }
}

/**
 * Resolve various input types to Uint8Array
 */
async function resolveInput(input: PdfInput): Promise<Uint8Array> {
  if (typeof input === 'string') {
    // File path
    try {
      const buffer = await fs.readFile(input);
      return new Uint8Array(buffer);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new PdfError(`File not found: ${input}`, 'FILE_NOT_FOUND', error);
      }
      throw new PdfError(`Failed to read file: ${input}`, 'INVALID_INPUT', error);
    }
  }

  if (input instanceof Buffer) {
    return new Uint8Array(input);
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  throw new PdfError('Invalid input type', 'INVALID_INPUT');
}

/**
 * Convert pdfjs-dist errors to PdfError
 */
function wrapPdfjsError(error: unknown): PdfError {
  if (error instanceof PdfError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Detect specific error types
  if (message.includes('Invalid PDF')) {
    return new PdfError('Invalid PDF file', 'INVALID_PDF', error);
  }

  if (message.includes('password')) {
    if (message.includes('incorrect')) {
      return new PdfError('Incorrect password', 'INVALID_PASSWORD', error);
    }
    return new PdfError('Password required to open this PDF', 'PASSWORD_REQUIRED', error);
  }

  return new PdfError(message, 'UNKNOWN', error);
}
