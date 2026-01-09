# pdf-simple

[日本語版 README](./README_ja.md)

A simple and efficient PDF conversion library for Node.js. Convert PDF pages to images (JPEG/PNG).

## Features

- Simple API - Open PDFs with `openPdf()` and convert to images with `renderPages()`
- Memory efficient - Process one page at a time using AsyncGenerator
- Japanese/CJK font support - Automatic CMap detection from pdfjs-dist
- Full TypeScript support - Includes type definitions
- ESM / CommonJS compatible
- `await using` syntax support (ES2024 AsyncDisposable)

## Installation

```bash
npm install pdf-simple
```

### Required Dependencies

This library requires [canvas](https://github.com/Automattic/node-canvas) as a peer dependency. Install the following system dependencies:

**macOS:**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

**Alpine Linux:**
```bash
apk add build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev
```

## Usage

### Basic Usage

```typescript
import { openPdf } from 'pdf-simple'
import fs from 'node:fs/promises'

// Open a PDF
const pdf = await openPdf('/path/to/document.pdf')
console.log(`Page count: ${pdf.pageCount}`)

// Convert all pages to images
for await (const page of pdf.renderPages({ format: 'jpeg', scale: 1.5 })) {
  console.log(`Converting page ${page.pageNumber}/${page.totalPages}...`)
  await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
}

// Always close when done
await pdf.close()
```

### await using Syntax (ES2024)

```typescript
import { openPdf } from 'pdf-simple'

// Using await using automatically closes the PDF
await using pdf = await openPdf('/path/to/document.pdf')

for await (const page of pdf.renderPages()) {
  // ...
}
// Automatically closed when scope ends
```

### Convenience Functions

```typescript
import { renderPdfPages, getPageCount } from 'pdf-simple'

// Convert all pages in one line (auto-closes)
for await (const page of renderPdfPages('/path/to/document.pdf', { scale: 2 })) {
  await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
}

// Get only the page count
const count = await getPageCount('/path/to/document.pdf')
console.log(`${count} pages`)
```

### Various Input Formats

```typescript
import { openPdf } from 'pdf-simple'

// File path
const pdf1 = await openPdf('/path/to/document.pdf')

// Buffer
const buffer = await fs.readFile('/path/to/document.pdf')
const pdf2 = await openPdf(buffer)

// Uint8Array
const response = await fetch('https://example.com/document.pdf')
const data = new Uint8Array(await response.arrayBuffer())
const pdf3 = await openPdf(data)

// Password-protected PDF
const pdf4 = await openPdf('/path/to/encrypted.pdf', { password: 'secret' })
```

### Converting Specific Pages

```typescript
// Convert a single page
const page = await pdf.renderPage(1)

// Specify page numbers
for await (const page of pdf.renderPages({ pages: [1, 3, 5] })) {
  // Converts only pages 1, 3, 5
}

// Specify page range
for await (const page of pdf.renderPages({ pages: { start: 2, end: 4 } })) {
  // Converts pages 2-4
}
```

### Rendering Options

```typescript
const options = {
  scale: 2.0,      // Scale factor (default: 1.5)
  format: 'png',   // 'jpeg' or 'png' (default: 'jpeg')
  quality: 0.9,    // JPEG quality 0-1 (default: 0.85)
}

for await (const page of pdf.renderPages(options)) {
  // ...
}
```

## API

### `openPdf(input, options?)`

Opens a PDF document.

- `input`: `string | Buffer | Uint8Array | ArrayBuffer` - File path or binary data
- `options.password?`: `string` - Password for encrypted PDFs
- `options.cMapPath?`: `string` - Custom path to CMap files
- `options.standardFontPath?`: `string` - Custom path to standard font files

### `PdfDocument`

```typescript
interface PdfDocument {
  readonly pageCount: number
  renderPages(options?: RenderOptions): AsyncGenerator<RenderedPage>
  renderPage(pageNumber: number, options?): Promise<RenderedPage>
  close(): Promise<void>
}
```

### `RenderedPage`

```typescript
interface RenderedPage {
  pageNumber: number      // Page number (1-based)
  totalPages: number      // Total number of pages
  buffer: Buffer          // Image data
  width: number           // Width in pixels
  height: number          // Height in pixels
}
```

### Error Handling

```typescript
import { openPdf, PdfError } from 'pdf-simple'

try {
  const pdf = await openPdf('/path/to/document.pdf')
} catch (error) {
  if (error instanceof PdfError) {
    switch (error.code) {
      case 'FILE_NOT_FOUND':
        console.error('File not found')
        break
      case 'INVALID_PDF':
        console.error('Invalid PDF file')
        break
      case 'PASSWORD_REQUIRED':
        console.error('Password required')
        break
      case 'INVALID_PASSWORD':
        console.error('Invalid password')
        break
      default:
        console.error(error.message)
    }
  }
}
```

## Requirements

- Node.js >= 20.0.0
- Native dependencies for canvas (see above)

## License

MIT
