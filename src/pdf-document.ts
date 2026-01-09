/**
 * PDF Document implementation using pdfjs-dist.
 *
 * This module contains the internal implementation of the PDF document
 * handling. It uses Mozilla's pdf.js library for PDF parsing and rendering.
 *
 * @module pdf-document
 * @internal
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
 * Internal implementation of the {@link PdfDocument} interface.
 *
 * This class wraps pdfjs-dist's PDFDocumentProxy and provides a
 * simpler, memory-efficient API for rendering PDF pages to images.
 *
 * @internal This class is not part of the public API. Use {@link openPdf} instead.
 */
export class PdfDocumentImpl implements PdfDocument {
  /**
   * The underlying pdfjs-dist document proxy.
   * @internal
   */
  private document: PDFDocumentProxy;

  /**
   * Whether the document has been closed.
   * @internal
   */
  private closed = false;

  /**
   * Creates a new PdfDocumentImpl instance.
   *
   * @param document - The pdfjs-dist document proxy
   * @internal
   */
  private constructor(document: PDFDocumentProxy) {
    this.document = document;
  }

  /**
   * Opens a PDF document from various input sources.
   *
   * This is the factory method for creating PdfDocumentImpl instances.
   * It handles input resolution and error wrapping.
   *
   * @param input - File path, Buffer, Uint8Array, or ArrayBuffer
   * @param options - Options for opening the PDF
   * @returns Promise resolving to a new PdfDocumentImpl instance
   * @throws {@link PdfError} if the PDF cannot be opened
   *
   * @internal Use {@link openPdf} from the public API instead.
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

  /**
   * Gets the total number of pages in the document.
   *
   * @returns The number of pages
   * @throws {@link PdfError} with code `DOCUMENT_CLOSED` if the document has been closed
   */
  public get pageCount(): number {
    this.ensureOpen();
    return this.document.numPages;
  }

  /**
   * Renders pages as images using an async generator.
   *
   * This method is memory-efficient as it processes one page at a time,
   * yielding each rendered page before moving to the next.
   *
   * @param options - Rendering options (scale, format, quality, pages)
   * @returns Async generator yielding {@link RenderedPage} for each page
   * @throws {@link PdfError} with code `DOCUMENT_CLOSED` if the document has been closed
   * @throws {@link PdfError} with code `INVALID_PAGE_NUMBER` if any specified page is out of range
   * @throws {@link PdfError} with code `RENDER_FAILED` if rendering fails
   */
  public async *renderPages(
    options: RenderOptions = {},
  ): AsyncGenerator<RenderedPage, void, unknown> {
    this.ensureOpen();

    const pageNumbers = this.resolvePageNumbers(options.pages);

    for (const pageNumber of pageNumbers) {
      yield await this.renderPageInternal(pageNumber, options);
    }
  }

  /**
   * Renders a single page to an image.
   *
   * @param pageNumber - Page number to render (1-indexed)
   * @param options - Rendering options (scale, format, quality)
   * @returns Promise resolving to the rendered page
   * @throws {@link PdfError} with code `DOCUMENT_CLOSED` if the document has been closed
   * @throws {@link PdfError} with code `INVALID_PAGE_NUMBER` if page number is out of range
   * @throws {@link PdfError} with code `RENDER_FAILED` if rendering fails
   */
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

  /**
   * Closes the document and releases all resources.
   *
   * This method is idempotent - calling it multiple times is safe.
   * After calling this method, the document cannot be used anymore.
   */
  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.document.destroy();
  }

  /**
   * Implements the AsyncDisposable interface for use with `await using`.
   *
   * This method is called automatically when the document goes out of scope
   * when using the `await using` syntax (ES2024).
   *
   * @internal
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  /**
   * Ensures the document is still open.
   *
   * @throws {@link PdfError} with code `DOCUMENT_CLOSED` if the document has been closed
   * @internal
   */
  private ensureOpen(): void {
    if (this.closed) {
      throw new PdfError('Document has been closed', 'DOCUMENT_CLOSED');
    }
  }

  /**
   * Resolves the pages option to an array of page numbers.
   *
   * @param pages - Page specification (array, range, or undefined for all)
   * @returns Array of page numbers to render
   * @throws {@link PdfError} with code `INVALID_PAGE_NUMBER` if any page is out of range
   * @internal
   */
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

  /**
   * Internal method to render a single page.
   *
   * This method handles the actual rendering using pdfjs-dist and canvas.
   * It creates a canvas, renders the page, and converts it to an image buffer.
   *
   * @param pageNumber - Page number to render (1-indexed, already validated)
   * @param options - Rendering options
   * @returns Promise resolving to the rendered page
   * @throws {@link PdfError} with code `RENDER_FAILED` if rendering fails
   * @internal
   */
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
 * Resolves various input types to a Uint8Array suitable for pdfjs-dist.
 *
 * This function handles:
 * - File paths (reads the file from disk)
 * - Node.js Buffers (converts to Uint8Array)
 * - Uint8Array (returns as-is)
 * - ArrayBuffer (wraps in Uint8Array)
 *
 * @param input - The PDF input (file path or binary data)
 * @returns Promise resolving to a Uint8Array of PDF data
 * @throws {@link PdfError} with code `FILE_NOT_FOUND` if the file doesn't exist
 * @throws {@link PdfError} with code `INVALID_INPUT` if the input type is unsupported
 *
 * @internal
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
 * Converts pdfjs-dist errors to {@link PdfError} instances.
 *
 * This function analyzes error messages to determine the appropriate
 * error code and creates a consistent error format.
 *
 * Error detection:
 * - "Invalid PDF" → `INVALID_PDF`
 * - "password" + "incorrect" → `INVALID_PASSWORD`
 * - "password" → `PASSWORD_REQUIRED`
 * - Other errors → `UNKNOWN`
 *
 * @param error - The error thrown by pdfjs-dist
 * @returns A PdfError with the appropriate code
 *
 * @internal
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
