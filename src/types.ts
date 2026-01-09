/**
 * Type definitions for pdf-simple
 *
 * This module exports all public types used by the pdf-simple library.
 *
 * @module types
 */

/**
 * Input types that can be used to open a PDF document.
 *
 * Supported input types:
 * - `string` - File path to a PDF file
 * - `Buffer` - Node.js Buffer containing PDF data
 * - `Uint8Array` - Typed array containing PDF data
 * - `ArrayBuffer` - Raw binary data containing PDF
 *
 * @example
 * ```typescript
 * // From file path
 * const pdf = await openPdf('/path/to/document.pdf')
 *
 * // From Buffer
 * const buffer = await fs.readFile('/path/to/document.pdf')
 * const pdf = await openPdf(buffer)
 *
 * // From Uint8Array (e.g., from fetch)
 * const response = await fetch('https://example.com/document.pdf')
 * const data = new Uint8Array(await response.arrayBuffer())
 * const pdf = await openPdf(data)
 * ```
 */
export type PdfInput = string | Buffer | Uint8Array | ArrayBuffer;

/**
 * Options for opening a PDF document.
 *
 * All options are optional. PDFium handles fonts automatically.
 *
 * @example
 * ```typescript
 * // Open with default options
 * const pdf = await openPdf('/path/to/document.pdf')
 *
 * // Open password-protected PDF
 * const pdf = await openPdf('/path/to/encrypted.pdf', {
 *   password: 'secret'
 * })
 * ```
 */
export interface PdfOpenOptions {
  /**
   * Password for opening encrypted PDFs.
   *
   * If the PDF is encrypted and no password is provided,
   * a {@link PdfError} with code `PASSWORD_REQUIRED` will be thrown.
   *
   * @example
   * ```typescript
   * const pdf = await openPdf('/path/to/encrypted.pdf', {
   *   password: 'secret'
   * })
   * ```
   */
  password?: string;
}

/**
 * Output format for rendered pages.
 *
 * - `'jpeg'` - JPEG format, smaller file size, lossy compression (default)
 * - `'png'` - PNG format, larger file size, lossless compression
 *
 * @example
 * ```typescript
 * // Render as JPEG (default)
 * for await (const page of pdf.renderPages({ format: 'jpeg' })) {
 *   await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
 * }
 *
 * // Render as PNG for higher quality
 * for await (const page of pdf.renderPages({ format: 'png' })) {
 *   await fs.writeFile(`page-${page.pageNumber}.png`, page.buffer)
 * }
 * ```
 */
export type RenderFormat = 'jpeg' | 'png';

/**
 * Specifies a range of pages to render.
 *
 * Both `start` and `end` are 1-indexed and inclusive.
 * If omitted, `start` defaults to 1 and `end` defaults to the last page.
 *
 * @example
 * ```typescript
 * // Render pages 1-5
 * for await (const page of pdf.renderPages({ pages: { start: 1, end: 5 } })) {
 *   // ...
 * }
 *
 * // Render from page 3 to the end
 * for await (const page of pdf.renderPages({ pages: { start: 3 } })) {
 *   // ...
 * }
 *
 * // Render first 10 pages
 * for await (const page of pdf.renderPages({ pages: { end: 10 } })) {
 *   // ...
 * }
 * ```
 */
export interface PageRange {
  /**
   * Start page number (1-indexed, inclusive).
   * @defaultValue 1
   */
  start?: number;
  /**
   * End page number (1-indexed, inclusive).
   * @defaultValue Last page of the document
   */
  end?: number;
}

/**
 * Options for rendering PDF pages to images.
 *
 * All options are optional with sensible defaults optimized for
 * quality and file size balance.
 *
 * @example
 * ```typescript
 * // Default options (scale: 1.5, format: 'jpeg', quality: 0.85)
 * for await (const page of pdf.renderPages()) {
 *   await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
 * }
 *
 * // High quality PNG output
 * for await (const page of pdf.renderPages({
 *   scale: 2.0,
 *   format: 'png'
 * })) {
 *   await fs.writeFile(`page-${page.pageNumber}.png`, page.buffer)
 * }
 *
 * // Render specific pages only
 * for await (const page of pdf.renderPages({
 *   pages: [1, 3, 5]  // Only pages 1, 3, and 5
 * })) {
 *   // ...
 * }
 * ```
 */
export interface RenderOptions {
  /**
   * Scale factor for rendering.
   *
   * Higher values produce larger, more detailed images but use more memory.
   * A scale of 1.0 renders at the PDF's natural size (72 DPI).
   * A scale of 2.0 renders at 144 DPI.
   *
   * @defaultValue 1.5
   *
   * @example
   * ```typescript
   * // Thumbnail (smaller, faster)
   * const options = { scale: 0.5 }
   *
   * // High resolution (larger, more detailed)
   * const options = { scale: 3.0 }
   * ```
   */
  scale?: number;

  /**
   * Output image format.
   *
   * - `'jpeg'` - Smaller file size, lossy compression (default)
   * - `'png'` - Larger file size, lossless compression
   *
   * @defaultValue 'jpeg'
   */
  format?: RenderFormat;

  /**
   * JPEG quality (0-1).
   *
   * Only applies when `format` is `'jpeg'`.
   * Higher values produce better quality but larger files.
   *
   * @defaultValue 0.85
   *
   * @example
   * ```typescript
   * // Low quality (smaller files)
   * const options = { format: 'jpeg', quality: 0.5 }
   *
   * // Maximum quality
   * const options = { format: 'jpeg', quality: 1.0 }
   * ```
   */
  quality?: number;

  /**
   * Specific pages to render (1-indexed).
   *
   * Can be either:
   * - An array of page numbers: `[1, 3, 5]`
   * - A range object: `{ start: 1, end: 5 }`
   *
   * If not specified, all pages are rendered.
   *
   * @defaultValue All pages
   *
   * @example
   * ```typescript
   * // Render specific pages
   * const options = { pages: [1, 5, 10] }
   *
   * // Render a range of pages
   * const options = { pages: { start: 1, end: 5 } }
   * ```
   */
  pages?: number[] | PageRange;
}

/**
 * Result of rendering a single PDF page to an image.
 *
 * Contains the rendered image data and metadata about the page.
 *
 * @example
 * ```typescript
 * for await (const page of pdf.renderPages()) {
 *   console.log(`Page ${page.pageNumber}/${page.totalPages}`)
 *   console.log(`Dimensions: ${page.width}x${page.height}`)
 *   await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
 * }
 * ```
 */
export interface RenderedPage {
  /**
   * Page number in the document (1-indexed).
   *
   * The first page is 1, not 0.
   */
  pageNumber: number;

  /**
   * Total number of pages in the document.
   *
   * Useful for progress reporting.
   */
  totalPages: number;

  /**
   * Rendered image data as a Node.js Buffer.
   *
   * Format depends on the `format` option used when rendering
   * (JPEG or PNG).
   */
  buffer: Buffer;

  /**
   * Width of the rendered image in pixels.
   *
   * Affected by the `scale` option.
   */
  width: number;

  /**
   * Height of the rendered image in pixels.
   *
   * Affected by the `scale` option.
   */
  height: number;
}

/**
 * Represents an opened PDF document.
 *
 * This interface provides methods to render PDF pages to images.
 * Implements {@link AsyncDisposable} for automatic resource cleanup
 * with ES2024 `await using` syntax.
 *
 * **Important:** Always close the document when done to release resources.
 * Use `await using` for automatic cleanup, or call {@link close} manually.
 *
 * @example
 * ```typescript
 * // Manual cleanup
 * const pdf = await openPdf('/path/to/document.pdf')
 * try {
 *   for await (const page of pdf.renderPages()) {
 *     await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
 *   }
 * } finally {
 *   await pdf.close()
 * }
 *
 * // Automatic cleanup with await using (ES2024)
 * await using pdf = await openPdf('/path/to/document.pdf')
 * for await (const page of pdf.renderPages()) {
 *   await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
 * }
 * // Automatically closed when scope ends
 * ```
 */
export interface PdfDocument extends AsyncDisposable {
  /**
   * Total number of pages in the document.
   *
   * @example
   * ```typescript
   * const pdf = await openPdf('/path/to/document.pdf')
   * console.log(`Document has ${pdf.pageCount} pages`)
   * ```
   */
  readonly pageCount: number;

  /**
   * Render pages as images using an async generator.
   *
   * This method is memory-efficient: it processes one page at a time
   * and releases resources for each page before moving to the next.
   *
   * @param options - Rendering options (scale, format, quality, pages)
   * @returns Async generator yielding {@link RenderedPage} for each page
   *
   * @example
   * ```typescript
   * // Render all pages
   * for await (const page of pdf.renderPages({ scale: 1.5, format: 'jpeg' })) {
   *   await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
   * }
   *
   * // Render specific pages
   * for await (const page of pdf.renderPages({ pages: [1, 2, 3] })) {
   *   // Only pages 1, 2, and 3
   * }
   * ```
   */
  renderPages(options?: RenderOptions): AsyncGenerator<RenderedPage, void, unknown>;

  /**
   * Render a single page to an image.
   *
   * Use this method when you only need to render one specific page.
   * For multiple pages, prefer {@link renderPages} for better memory efficiency.
   *
   * @param pageNumber - Page number to render (1-indexed)
   * @param options - Rendering options (scale, format, quality). The `pages` option is ignored.
   * @returns Promise resolving to the rendered page
   * @throws {@link PdfError} with code `INVALID_PAGE_NUMBER` if page number is out of range
   *
   * @example
   * ```typescript
   * // Render just the first page
   * const firstPage = await pdf.renderPage(1)
   * await fs.writeFile('first-page.jpg', firstPage.buffer)
   *
   * // Render with custom options
   * const page = await pdf.renderPage(5, { scale: 2.0, format: 'png' })
   * ```
   */
  renderPage(pageNumber: number, options?: Omit<RenderOptions, 'pages'>): Promise<RenderedPage>;

  /**
   * Close the document and release all resources.
   *
   * After calling this method, the document cannot be used anymore.
   * This method is idempotent (safe to call multiple times).
   *
   * When using `await using` syntax, this method is called automatically.
   *
   * @example
   * ```typescript
   * const pdf = await openPdf('/path/to/document.pdf')
   * // ... use the document ...
   * await pdf.close()
   * ```
   */
  close(): Promise<void>;
}

/**
 * Error thrown when PDF operations fail.
 *
 * All errors from pdf-simple are instances of this class,
 * with a specific {@link PdfErrorCode} to identify the type of error.
 *
 * @example
 * ```typescript
 * import { openPdf, PdfError } from 'pdf-simple'
 *
 * try {
 *   const pdf = await openPdf('/path/to/encrypted.pdf')
 * } catch (error) {
 *   if (error instanceof PdfError) {
 *     switch (error.code) {
 *       case 'PASSWORD_REQUIRED':
 *         console.log('This PDF requires a password')
 *         break
 *       case 'FILE_NOT_FOUND':
 *         console.log('File does not exist')
 *         break
 *       default:
 *         console.log(`Error: ${error.message}`)
 *     }
 *   }
 * }
 * ```
 */
export class PdfError extends Error {
  /**
   * Creates a new PdfError instance.
   *
   * @param message - Human-readable error message
   * @param code - Error code identifying the type of error
   * @param cause - Original error that caused this error (if any)
   */
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
 * Error codes for PDF operations.
 *
 * Each code identifies a specific type of error:
 *
 * | Code | Description |
 * |------|-------------|
 * | `INVALID_INPUT` | Input is not a valid file path, Buffer, Uint8Array, or ArrayBuffer |
 * | `FILE_NOT_FOUND` | The specified file path does not exist |
 * | `INVALID_PDF` | The input data is not a valid PDF file |
 * | `PASSWORD_REQUIRED` | The PDF is encrypted and requires a password |
 * | `INVALID_PASSWORD` | The provided password is incorrect |
 * | `INVALID_PAGE_NUMBER` | The page number is out of range (less than 1 or greater than pageCount) |
 * | `RENDER_FAILED` | Failed to render a page to an image |
 * | `DOCUMENT_CLOSED` | Attempted to use a document after it was closed |
 * | `UNKNOWN` | An unexpected error occurred |
 *
 * @example
 * ```typescript
 * import { PdfError, type PdfErrorCode } from 'pdf-simple'
 *
 * function handleError(code: PdfErrorCode): string {
 *   switch (code) {
 *     case 'PASSWORD_REQUIRED':
 *       return 'Please provide a password'
 *     case 'INVALID_PASSWORD':
 *       return 'Wrong password'
 *     case 'FILE_NOT_FOUND':
 *       return 'File not found'
 *     default:
 *       return 'An error occurred'
 *   }
 * }
 * ```
 */
export type PdfErrorCode =
  /** Input is not a valid file path, Buffer, Uint8Array, or ArrayBuffer */
  | 'INVALID_INPUT'
  /** The specified file path does not exist */
  | 'FILE_NOT_FOUND'
  /** The input data is not a valid PDF file */
  | 'INVALID_PDF'
  /** The PDF is encrypted and requires a password */
  | 'PASSWORD_REQUIRED'
  /** The provided password is incorrect */
  | 'INVALID_PASSWORD'
  /** The page number is out of range */
  | 'INVALID_PAGE_NUMBER'
  /** Failed to render a page to an image */
  | 'RENDER_FAILED'
  /** Attempted to use a document after it was closed */
  | 'DOCUMENT_CLOSED'
  /** An unexpected error occurred */
  | 'UNKNOWN';
