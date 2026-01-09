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
  FontErrorType,
  FontWarning,
  PageRange,
  PdfDocument,
  PdfInput,
  PdfOpenOptions,
  RenderedPage,
  RenderOptions,
} from './types.js';
import {
  CffFontError,
  FontError,
  GeneralFontError,
  GlyphError,
  PdfError,
  TrueTypeFontError,
  Type1FontError,
  Type3FontError,
  XfaFontError,
} from './types.js';

/**
 * Patterns for detecting font-related warnings from pdfjs-dist.
 * @internal
 */
const FONT_WARNING_PATTERNS: Array<{ pattern: RegExp; type: FontErrorType }> = [
  // TrueType patterns
  { pattern: /TT:\s+/i, type: 'TRUETYPE' },
  { pattern: /TrueType Collection/i, type: 'TRUETYPE' },

  // CFF patterns
  { pattern: /CFF\s+/i, type: 'CFF' },
  { pattern: /CFFParser/i, type: 'CFF' },
  { pattern: /CFFDict/i, type: 'CFF' },
  { pattern: /charstrings/i, type: 'CFF' },
  { pattern: /Invalid fd index/i, type: 'CFF' },

  // Type1 patterns
  { pattern: /Type1 font/i, type: 'TYPE1' },
  { pattern: /"Length1" property/i, type: 'TYPE1' },

  // Type3 patterns
  { pattern: /Type3 character/i, type: 'TYPE3' },
  { pattern: /Type3 font resource/i, type: 'TYPE3' },

  // Glyph patterns
  { pattern: /charToGlyph/i, type: 'GLYPH' },
  { pattern: /glyfs/i, type: 'GLYPH' },
  { pattern: /glyph/i, type: 'GLYPH' },
  { pattern: /buildFontPaths/i, type: 'GLYPH' },

  // XFA patterns
  { pattern: /XFA.*font/i, type: 'XFA' },

  // General font patterns (checked last as catch-all for font issues)
  { pattern: /font/i, type: 'GENERAL' },
];

/**
 * Determines the font error type from a warning message.
 *
 * @param message - The warning message to analyze
 * @returns The font error type, or null if not a font warning
 * @internal
 */
function getFontErrorType(message: string): FontErrorType | null {
  // Only process messages that contain font-related keywords
  if (!/font|glyph|TT:|CFF|Type[13]|XFA|charstring/i.test(message)) {
    return null;
  }

  for (const { pattern, type } of FONT_WARNING_PATTERNS) {
    if (pattern.test(message)) {
      return type;
    }
  }

  return null;
}

/**
 * Class to capture font warnings from pdfjs-dist during rendering.
 *
 * pdfjs-dist outputs warnings to console.log with a "Warning: " prefix.
 * This class temporarily intercepts console.log to capture font-related warnings.
 *
 * @internal
 */
class FontWarningCapture {
  private warnings: FontWarning[] = [];
  private originalConsoleLog: typeof console.log;
  private isCapturing = false;

  /**
   * Start capturing font warnings.
   */
  public start(): void {
    if (this.isCapturing) {
      return;
    }

    this.warnings = [];
    this.originalConsoleLog = console.log;
    this.isCapturing = true;

    console.log = (...args: unknown[]) => {
      // Check if this is a pdfjs-dist warning
      if (args.length > 0 && typeof args[0] === 'string') {
        const message = args[0];

        // pdfjs-dist format: "Warning: <message>"
        if (message.startsWith('Warning: ')) {
          const warningContent = message.slice('Warning: '.length);
          const fontErrorType = getFontErrorType(warningContent);

          if (fontErrorType) {
            this.warnings.push({
              type: fontErrorType,
              message: warningContent,
            });
          }
        }
      }

      // Always call original console.log
      this.originalConsoleLog.apply(console, args);
    };
  }

  /**
   * Stop capturing and restore original console.log.
   */
  public stop(): void {
    if (!this.isCapturing) {
      return;
    }

    console.log = this.originalConsoleLog;
    this.isCapturing = false;
  }

  /**
   * Get all captured warnings.
   */
  public getWarnings(): FontWarning[] {
    return [...this.warnings];
  }

  /**
   * Check if any warnings were captured.
   */
  public hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Clear all captured warnings.
   */
  public clear(): void {
    this.warnings = [];
  }
}

/**
 * Creates an appropriate FontError subclass based on the captured warnings.
 *
 * The most specific error type is chosen based on the warnings:
 * - If there are TrueType warnings, throws TrueTypeFontError
 * - If there are CFF warnings, throws CffFontError
 * - etc.
 * - If there are multiple types, the primary type is determined by priority.
 *
 * @param warnings - The captured font warnings
 * @returns The appropriate FontError subclass instance
 * @internal
 */
function createFontError(warnings: FontWarning[]): FontError {
  // Count warnings by type
  const typeCounts = new Map<FontErrorType, number>();
  for (const warning of warnings) {
    typeCounts.set(warning.type, (typeCounts.get(warning.type) || 0) + 1);
  }

  // Priority order for determining primary error type
  const priority: FontErrorType[] = [
    'TRUETYPE',
    'CFF',
    'TYPE1',
    'TYPE3',
    'GLYPH',
    'XFA',
    'GENERAL',
  ];

  // Find the primary error type (first one with warnings in priority order)
  let primaryType: FontErrorType = 'GENERAL';
  for (const type of priority) {
    if (typeCounts.has(type)) {
      primaryType = type;
      break;
    }
  }

  // Create summary message
  const typeNames: Record<FontErrorType, string> = {
    TRUETYPE: 'TrueType',
    CFF: 'CFF',
    TYPE1: 'Type1',
    TYPE3: 'Type3',
    GLYPH: 'Glyph',
    XFA: 'XFA',
    GENERAL: 'Font',
  };

  const typeSummary = Array.from(typeCounts.entries())
    .map(([type, count]) => `${typeNames[type]}(${count})`)
    .join(', ');

  const message = `Font errors detected during PDF rendering: ${typeSummary}. Total: ${warnings.length} warning(s).`;

  // Create appropriate error subclass
  switch (primaryType) {
    case 'TRUETYPE':
      return new TrueTypeFontError(message, warnings);
    case 'CFF':
      return new CffFontError(message, warnings);
    case 'TYPE1':
      return new Type1FontError(message, warnings);
    case 'TYPE3':
      return new Type3FontError(message, warnings);
    case 'GLYPH':
      return new GlyphError(message, warnings);
    case 'XFA':
      return new XfaFontError(message, warnings);
    default:
      return new GeneralFontError(message, warnings);
  }
}

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
   * Whether to throw errors on font warnings.
   * @internal
   */
  private throwOnFontError: boolean;

  /**
   * Font warning capture instance for collecting warnings during rendering.
   * @internal
   */
  private warningCapture: FontWarningCapture;

  /**
   * Creates a new PdfDocumentImpl instance.
   *
   * @param document - The pdfjs-dist document proxy
   * @param throwOnFontError - Whether to throw errors on font warnings
   * @internal
   */
  private constructor(document: PDFDocumentProxy, throwOnFontError: boolean) {
    this.document = document;
    this.throwOnFontError = throwOnFontError;
    this.warningCapture = new FontWarningCapture();
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
      return new PdfDocumentImpl(document, options.throwOnFontError ?? false);
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
   * If `throwOnFontError` is enabled, font warnings are captured and thrown as errors.
   *
   * @param pageNumber - Page number to render (1-indexed, already validated)
   * @param options - Rendering options
   * @returns Promise resolving to the rendered page
   * @throws {@link PdfError} with code `RENDER_FAILED` if rendering fails
   * @throws {@link FontError} or its subclasses if font issues are detected and `throwOnFontError` is enabled
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

    // Start capturing font warnings if throwOnFontError is enabled
    if (this.throwOnFontError) {
      this.warningCapture.start();
    }

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

      // Check for font warnings if throwOnFontError is enabled
      if (this.throwOnFontError && this.warningCapture.hasWarnings()) {
        const warnings = this.warningCapture.getWarnings();
        throw createFontError(warnings);
      }

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
      // Re-throw FontError instances directly
      if (error instanceof FontError) {
        throw error;
      }

      throw new PdfError(
        `Failed to render page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`,
        'RENDER_FAILED',
        error,
      );
    } finally {
      // Stop capturing and clean up
      if (this.throwOnFontError) {
        this.warningCapture.stop();
        this.warningCapture.clear();
      }

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
