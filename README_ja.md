# pdf-simple

Node.js 向けのシンプルで効率的な PDF 変換ライブラリです。PDF ページを画像（JPEG/PNG）に変換できます。

## 特徴

- シンプルな API - `openPdf()` でPDFを開き、`renderPages()` で画像に変換
- メモリ効率 - AsyncGenerator を使用した1ページずつの処理
- 日本語・CJK フォント対応 - pdfjs-dist の CMap を自動検出
- TypeScript 完全対応 - 型定義付き
- ESM / CommonJS 両対応
- `await using` 構文対応（ES2024 AsyncDisposable）

## インストール

```bash
npm install pdf-simple
```

### 必須依存

このライブラリは [canvas](https://github.com/Automattic/node-canvas) を peer dependency として必要とします。システムに以下の依存関係をインストールしてください：

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

## 使用方法

### 基本的な使い方

```typescript
import { openPdf } from 'pdf-simple'
import fs from 'node:fs/promises'

// PDFを開く
const pdf = await openPdf('/path/to/document.pdf')
console.log(`ページ数: ${pdf.pageCount}`)

// 全ページを画像に変換
for await (const page of pdf.renderPages({ format: 'jpeg', scale: 1.5 })) {
  console.log(`${page.pageNumber}/${page.totalPages} ページを変換中...`)
  await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
}

// 完了後は必ず閉じる
await pdf.close()
```

### await using 構文（ES2024）

```typescript
import { openPdf } from 'pdf-simple'

// await using を使えば自動でクローズされる
await using pdf = await openPdf('/path/to/document.pdf')

for await (const page of pdf.renderPages()) {
  // ...
}
// スコープ終了時に自動でクローズ
```

### 便利関数

```typescript
import { renderPdfPages, getPageCount } from 'pdf-simple'

// 1行で全ページを変換（自動でクローズ）
for await (const page of renderPdfPages('/path/to/document.pdf', { scale: 2 })) {
  await fs.writeFile(`page-${page.pageNumber}.jpg`, page.buffer)
}

// ページ数だけを取得
const count = await getPageCount('/path/to/document.pdf')
console.log(`${count} ページ`)
```

### 様々な入力形式

```typescript
import { openPdf } from 'pdf-simple'

// ファイルパス
const pdf1 = await openPdf('/path/to/document.pdf')

// Buffer
const buffer = await fs.readFile('/path/to/document.pdf')
const pdf2 = await openPdf(buffer)

// Uint8Array
const response = await fetch('https://example.com/document.pdf')
const data = new Uint8Array(await response.arrayBuffer())
const pdf3 = await openPdf(data)

// パスワード付きPDF
const pdf4 = await openPdf('/path/to/encrypted.pdf', { password: 'secret' })
```

### 特定ページの変換

```typescript
// 単一ページを変換
const page = await pdf.renderPage(1)

// 特定のページ番号を指定
for await (const page of pdf.renderPages({ pages: [1, 3, 5] })) {
  // 1, 3, 5 ページのみ変換
}

// ページ範囲を指定
for await (const page of pdf.renderPages({ pages: { start: 2, end: 4 } })) {
  // 2〜4 ページを変換
}
```

### レンダリングオプション

```typescript
const options = {
  scale: 2.0,      // スケール（デフォルト: 1.5）
  format: 'png',   // 'jpeg' または 'png'（デフォルト: 'jpeg'）
  quality: 0.9,    // JPEG品質 0-1（デフォルト: 0.85）
}

for await (const page of pdf.renderPages(options)) {
  // ...
}
```

## API

### `openPdf(input, options?)`

PDFドキュメントを開きます。

- `input`: `string | Buffer | Uint8Array | ArrayBuffer` - ファイルパスまたはバイナリデータ
- `options.password?`: `string` - 暗号化PDFのパスワード
- `options.cMapPath?`: `string` - CMapファイルへのカスタムパス
- `options.standardFontPath?`: `string` - 標準フォントファイルへのカスタムパス

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
  pageNumber: number      // ページ番号（1始まり）
  totalPages: number      // 総ページ数
  buffer: Buffer          // 画像データ
  width: number           // 幅（ピクセル）
  height: number          // 高さ（ピクセル）
}
```

### エラーハンドリング

```typescript
import { openPdf, PdfError } from 'pdf-simple'

try {
  const pdf = await openPdf('/path/to/document.pdf')
} catch (error) {
  if (error instanceof PdfError) {
    switch (error.code) {
      case 'FILE_NOT_FOUND':
        console.error('ファイルが見つかりません')
        break
      case 'INVALID_PDF':
        console.error('無効なPDFファイルです')
        break
      case 'PASSWORD_REQUIRED':
        console.error('パスワードが必要です')
        break
      case 'INVALID_PASSWORD':
        console.error('パスワードが間違っています')
        break
      default:
        console.error(error.message)
    }
  }
}
```

## 動作環境

- Node.js >= 20.0.0
- canvas のネイティブ依存関係（上記参照）

## ライセンス

MIT
