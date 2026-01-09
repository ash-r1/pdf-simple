/**
 * Type definitions for pdf-simple
 */

/**
 * Input types that can be used to open a PDF document
 */
export type PdfInput = string | Buffer | Uint8Array | ArrayBuffer;

/**
 * Options for opening a PDF document
 */
export interface PdfOpenOptions {
  /**
   * Custom path to CMap files for CJK font support
   * If not specified, automatically detected from pdfjs-dist package
   */
  cMapPath?: string;

  /**
   * Custom path to standard font files
   * If not specified, automatically detected from pdfjs-dist package
   */
  standardFontPath?: string;

  /**
   * Password for encrypted PDFs
   */
  password?: string;
}

/**
 * Output format for rendered pages
 */
export type RenderFormat = 'jpeg' | 'png';

/**
 * Page range specification
 */
export interface PageRange {
  /** Start page (1-indexed, inclusive). Defaults to 1 */
  start?: number;
  /** End page (1-indexed, inclusive). Defaults to last page */
  end?: number;
}

/**
 * Options for rendering PDF pages to images
 */
export interface RenderOptions {
  /**
   * Scale factor for rendering
   * Higher values produce larger, more detailed images but use more memory
   * @default 1.5
   */
  scale?: number;

  /**
   * Output image format
   * @default 'jpeg'
   */
  format?: RenderFormat;

  /**
   * JPEG quality (0-1). Only applies when format is 'jpeg'
   * @default 0.85
   */
  quality?: number;

  /**
   * Specific pages to render (1-indexed).
   * Can be an array of page numbers or a range object
   * @default all pages
   */
  pages?: number[] | PageRange;
}

/**
 * Result of rendering a single page
 */
export interface RenderedPage {
  /** Page number (1-indexed) */
  pageNumber: number;

  /** Total number of pages in the document */
  totalPages: number;

  /** Rendered image as a Buffer */
  buffer: Buffer;

  /** Width of the rendered image in pixels */
  width: number;

  /** Height of the rendered image in pixels */
  height: number;
}

/**
 * PDF document interface
 * Implements AsyncDisposable for use with `await using` syntax
 */
export interface PdfDocument extends AsyncDisposable {
  /**
   * Number of pages in the document
   */
  readonly pageCount: number;

  /**
   * Render pages as images using an async generator
   * Memory-efficient: processes one page at a time
   *
   * @param options - Rendering options
   * @yields RenderedPage for each page
   *
   * @example
   * ```typescript
   * for await (const page of pdf.renderPages({ scale: 1.5, format: 'jpeg' })) {
   *   await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
   * }
   * ```
   */
  renderPages(options?: RenderOptions): AsyncGenerator<RenderedPage, void, unknown>;

  /**
   * Render a single page
   *
   * @param pageNumber - Page number to render (1-indexed)
   * @param options - Rendering options (pages option is ignored)
   * @returns Promise resolving to the rendered page
   */
  renderPage(pageNumber: number, options?: Omit<RenderOptions, 'pages'>): Promise<RenderedPage>;

  /**
   * Close the document and release all resources
   * Called automatically when using `await using` syntax
   */
  close(): Promise<void>;
}

/**
 * Error thrown when PDF operations fail
 */
export class PdfError extends Error {
  public constructor(
    message: string,
    public readonly code: PdfErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

/**
 * Error codes for PDF operations
 */
export type PdfErrorCode =
  | 'INVALID_INPUT'
  | 'FILE_NOT_FOUND'
  | 'INVALID_PDF'
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'INVALID_PAGE_NUMBER'
  | 'RENDER_FAILED'
  | 'DOCUMENT_CLOSED'
  | 'UNKNOWN';
