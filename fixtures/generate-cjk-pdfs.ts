/**
 * Script to generate CJK test PDFs using system fonts
 *
 * Usage: npx tsx fixtures/generate-cjk-pdfs.ts
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'node:fs';
import * as path from 'node:path';

// System font paths (commonly available on Linux)
// Using IPA Gothic for all CJK - supports Japanese, common Chinese characters, and some Korean
const SYSTEM_FONTS = {
  // IPA Gothic - Japanese font (also covers many CJK characters)
  japanese: '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
  // IPA Gothic - covers simplified Chinese characters commonly used in Japanese
  chinese: '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
  // IPA Gothic - covers basic Korean Hanja
  korean: '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
};

// Test text for each language
const TEST_TEXT = {
  japanese: {
    title: '日本語テスト',
    content: 'こんにちは、世界！これは日本語のPDFテストです。',
    subtitle: 'ひらがな・カタカナ・漢字',
  },
  chinese: {
    title: '中文测试',
    content: '你好，世界！这是中文PDF测试。',
    subtitle: '简体中文字符',
  },
  korean: {
    title: '한국어 테스트',
    content: '안녕하세요, 세계! 이것은 한국어 PDF 테스트입니다.',
    subtitle: '한글 문자',
  },
};

function loadSystemFont(fontPath: string): Buffer {
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font not found: ${fontPath}`);
  }
  return fs.readFileSync(fontPath);
}

async function createCjkPdf(
  fontBytes: Buffer,
  text: { title: string; content: string; subtitle: string },
  language: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const customFont = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { height } = page.getSize();

  // Draw title
  page.drawText(text.title, {
    x: 50,
    y: height - 100,
    size: 32,
    font: customFont,
    color: rgb(0, 0, 0),
  });

  // Draw subtitle
  page.drawText(text.subtitle, {
    x: 50,
    y: height - 150,
    size: 18,
    font: customFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Draw content
  page.drawText(text.content, {
    x: 50,
    y: height - 220,
    size: 16,
    font: customFont,
    color: rgb(0, 0, 0),
  });

  // Draw language identifier
  page.drawText(`Language: ${language}`, {
    x: 50,
    y: 50,
    size: 12,
    font: customFont,
    color: rgb(0.6, 0.6, 0.6),
  });

  return pdfDoc.save();
}

async function main() {
  const fixturesDir = path.dirname(new URL(import.meta.url).pathname);

  console.log('Generating CJK PDFs using system fonts...');

  for (const [language, fontPath] of Object.entries(SYSTEM_FONTS)) {
    console.log(`Processing ${language}...`);

    try {
      // Load system font
      console.log(`  Loading font from ${fontPath}`);
      const fontBytes = loadSystemFont(fontPath);
      console.log(`  Font loaded: ${fontBytes.length} bytes`);

      // Generate PDF
      const text = TEST_TEXT[language as keyof typeof TEST_TEXT];
      const pdfBytes = await createCjkPdf(fontBytes, text, language);

      // Save PDF
      const outputPath = path.join(fixturesDir, `${language}.pdf`);
      fs.writeFileSync(outputPath, pdfBytes);
      console.log(`  PDF saved: ${outputPath}`);
    } catch (error) {
      console.error(`  Error processing ${language}:`, error);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
