/**
 * Utility to generate test PDF fixtures.
 *
 * Run with: pnpm tsx src/test-utils/generate-fixtures.ts
 *
 * @module test-utils/generate-fixtures
 * @internal
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const currentDir: string = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR: string = path.join(currentDir, '../../fixtures/pdfs');

/**
 * Generates a simple text PDF.
 */
async function generateSimpleTextPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('Hello, World!', {
    x: 50,
    y: 700,
    size: 30,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText('This is a test PDF document.', {
    x: 50,
    y: 650,
    size: 16,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  return doc.save();
}

/**
 * Generates a PDF with colored shapes.
 */
async function generateShapesPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);

  // Red rectangle
  page.drawRectangle({
    x: 50,
    y: 250,
    width: 100,
    height: 100,
    color: rgb(1, 0, 0),
  });

  // Green rectangle
  page.drawRectangle({
    x: 200,
    y: 250,
    width: 100,
    height: 100,
    color: rgb(0, 1, 0),
  });

  // Blue rectangle
  page.drawRectangle({
    x: 125,
    y: 100,
    width: 100,
    height: 100,
    color: rgb(0, 0, 1),
  });

  return doc.save();
}

/**
 * Generates a multi-page PDF with page numbers.
 */
async function generateMultiPagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([612, 792]);

    page.drawText(`Page ${i}`, {
      x: 250,
      y: 400,
      size: 48,
      font,
      color: rgb(0, 0, 0),
    });

    // Different colored rectangle on each page
    const colors = [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)];
    page.drawRectangle({
      x: 200,
      y: 200,
      width: 200,
      height: 100,
      color: colors[i - 1],
    });
  }

  return doc.save();
}

/**
 * Generates a PDF with gradients (simulated with rectangles).
 */
async function generateGradientPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 200]);

  // Simulate gradient with thin rectangles
  const steps = 100;
  const rectWidth = 400 / steps;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    page.drawRectangle({
      x: i * rectWidth,
      y: 0,
      width: rectWidth + 1, // +1 to avoid gaps
      height: 200,
      color: rgb(t, 0, 1 - t),
    });
  }

  return doc.save();
}

async function main(): Promise<void> {
  // Ensure fixtures directory exists
  await fs.mkdir(FIXTURES_DIR, { recursive: true });

  const fixtures = [
    { name: 'simple-text.pdf', generator: generateSimpleTextPdf },
    { name: 'shapes.pdf', generator: generateShapesPdf },
    { name: 'multi-page.pdf', generator: generateMultiPagePdf },
    { name: 'gradient.pdf', generator: generateGradientPdf },
  ];

  for (const { name, generator } of fixtures) {
    const data = await generator();
    const filePath = path.join(FIXTURES_DIR, name);
    await fs.writeFile(filePath, data);
    console.log(`Generated: ${filePath}`);
  }

  console.log('All fixtures generated successfully!');
}

main().catch(console.error);
