/**
 * Generate Unicode test PDFs WITHOUT embedded fonts.
 * These PDFs reference system fonts (like MS Gothic, SimSun, etc.)
 * to test font fallback behavior in PDFium.
 *
 * This creates PDFs that should display "tofu" (□) when system fonts are unavailable.
 */

import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, '../fixtures/pdfs/unicode-charts');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Create a ToUnicode CMap for proper character mapping.
 * This allows the PDF to specify which Unicode characters should be rendered.
 */
function createToUnicodeCMap(chars) {
  const uniqueChars = [...new Set(chars)];
  const mappings = uniqueChars
    .filter(c => c.charCodeAt(0) > 127) // Only map non-ASCII
    .map((c, i) => {
      const code = (i + 1).toString(16).padStart(4, '0').toUpperCase();
      const unicode = c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase();
      return `<${code}> <${unicode}>`;
    })
    .join('\n');

  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0001> <FFFF>
endcodespacerange
${uniqueChars.filter(c => c.charCodeAt(0) > 127).length} beginbfchar
${mappings}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}

/**
 * Create a PDF with CJK text that references a non-embedded font.
 * Uses proper CID encoding with ToUnicode CMap.
 */
function createNonEmbeddedPdf(config) {
  const { filename, title, fontName, cidOrdering, textLines, pageWidth = 612, pageHeight = 792 } = config;

  // Collect all characters for ToUnicode CMap
  const allChars = textLines.join('').split('');
  const nonAsciiChars = allChars.filter(c => c.charCodeAt(0) > 127);

  // Create character to CID mapping
  const charToCid = new Map();
  let cidCounter = 1;
  for (const c of nonAsciiChars) {
    if (!charToCid.has(c)) {
      charToCid.set(c, cidCounter++);
    }
  }

  // Build text showing operations with proper CID encoding
  const textOps = textLines.map((line, i) => {
    const hexText = Array.from(line)
      .map(c => {
        if (c.charCodeAt(0) <= 127) {
          // ASCII: use single byte
          return c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase();
        } else {
          // CJK: use CID
          const cid = charToCid.get(c) || 0;
          return cid.toString(16).padStart(4, '0').toUpperCase();
        }
      })
      .join('');
    return `0 -22 Td\n<${hexText}> Tj`;
  }).join('\n');

  // Create ToUnicode CMap
  const toUnicode = createToUnicodeCMap(allChars);
  const toUnicodeLength = Buffer.byteLength(toUnicode, 'utf-8');

  const streamContent = `BT
/F1 14 Tf
50 ${pageHeight - 60} Td
${textOps}
ET`;

  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  // Calculate offsets for xref table
  const obj1Start = 17;
  const obj2Start = obj1Start + 58;
  const obj3Start = obj2Start + 57;
  const obj4Start = obj3Start + 160;
  const obj5Start = obj4Start + 50 + streamLength;
  const obj6Start = obj5Start + 140;
  const obj7Start = obj6Start + 200;
  const xrefStart = obj7Start + 50 + toUnicodeLength;

  const pdf = `%PDF-1.7
%âãÏÓ

1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 ${pageWidth} ${pageHeight}]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 5 0 R
    >>
  >>
>>
endobj

4 0 obj
<<
  /Length ${streamLength}
>>
stream
${streamContent}
endstream
endobj

5 0 obj
<<
  /Type /Font
  /Subtype /Type0
  /BaseFont /${fontName}
  /Encoding /Identity-H
  /DescendantFonts [6 0 R]
  /ToUnicode 7 0 R
>>
endobj

6 0 obj
<<
  /Type /Font
  /Subtype /CIDFontType2
  /BaseFont /${fontName}
  /CIDSystemInfo <<
    /Registry (Adobe)
    /Ordering (${cidOrdering})
    /Supplement 0
  >>
  /DW 1000
>>
endobj

7 0 obj
<<
  /Length ${toUnicodeLength}
>>
stream
${toUnicode}
endstream
endobj

xref
0 8
0000000000 65535 f
0000000017 00000 n
0000000075 00000 n
0000000132 00000 n
0000000292 00000 n
0000000${(342 + streamLength).toString().padStart(3, '0')} 00000 n
0000000${(482 + streamLength).toString().padStart(3, '0')} 00000 n
0000000${(682 + streamLength).toString().padStart(3, '0')} 00000 n

trailer
<<
  /Size 8
  /Root 1 0 R
>>
startxref
${xrefStart}
%%EOF`;

  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, pdf, 'binary');
  console.log(`Created: ${outputPath}`);
  return outputPath;
}

// Generate test PDFs for different Unicode ranges

// 1. CJK Unified Ideographs (Basic) - U+4E00 to U+9FFF
// Common characters used in Chinese, Japanese, and Korean
createNonEmbeddedPdf({
  filename: 'cjk-unified-basic-nonembed.pdf',
  title: 'CJK Unified Ideographs (Basic)',
  fontName: 'MS-Gothic',
  cidOrdering: 'Japan1',
  textLines: [
    'CJK Basic U+4E00-U+9FFF',
    '一二三四五六七八九十',        // U+4E00 range: numbers
    '日本語文字テスト',            // Common Japanese
    '中文简体繁體测试',            // Chinese simplified/traditional
    '한국어문자테스트',            // Korean
    '東京大阪名古屋福岡',          // Japanese cities
    '北京上海广州深圳',            // Chinese cities
    '人口時間場所事物',            // Common kanji
  ]
});

// 2. Hiragana - U+3040 to U+309F
createNonEmbeddedPdf({
  filename: 'hiragana-nonembed.pdf',
  title: 'Hiragana',
  fontName: 'MS-Gothic',
  cidOrdering: 'Japan1',
  textLines: [
    'Hiragana U+3040-U+309F',
    'あいうえお',
    'かきくけこ',
    'さしすせそ',
    'たちつてと',
    'なにぬねの',
    'はひふへほ',
    'まみむめも',
    'やゆよ',
    'らりるれろ',
    'わをん',
    'がぎぐげご',
    'ぱぴぷぺぽ',
  ]
});

// 3. Katakana - U+30A0 to U+30FF
createNonEmbeddedPdf({
  filename: 'katakana-nonembed.pdf',
  title: 'Katakana',
  fontName: 'MS-Gothic',
  cidOrdering: 'Japan1',
  textLines: [
    'Katakana U+30A0-U+30FF',
    'アイウエオ',
    'カキクケコ',
    'サシスセソ',
    'タチツテト',
    'ナニヌネノ',
    'ハヒフヘホ',
    'マミムメモ',
    'ヤユヨ',
    'ラリルレロ',
    'ワヲン',
    'ガギグゲゴ',
    'パピプペポ',
  ]
});

// 4. Hangul Syllables - U+AC00 to U+D7AF
createNonEmbeddedPdf({
  filename: 'hangul-syllables-nonembed.pdf',
  title: 'Hangul Syllables',
  fontName: 'Malgun-Gothic',
  cidOrdering: 'Korea1',
  textLines: [
    'Hangul U+AC00-U+D7AF',
    '가나다라마바사',
    '아자차카타파하',
    '한글테스트',
    '서울부산대구인천',
    '안녕하세요',
    '감사합니다',
    '대한민국',
  ]
});

// 5. CJK Extension A - U+3400 to U+4DBF (rare characters)
createNonEmbeddedPdf({
  filename: 'cjk-ext-a-nonembed.pdf',
  title: 'CJK Extension A',
  fontName: 'SimSun',
  cidOrdering: 'GB1',
  textLines: [
    'CJK Ext A U+3400-U+4DBF',
    '㐀㐁㐂㐃㐄㐅㐆㐇',    // U+3400-U+3407
    '㐈㐉㐊㐋㐌㐍㐎㐏',    // U+3408-U+340F
    '㑀㑁㑂㑃㑄㑅㑆㑇',    // U+3440-U+3447
    '㒀㒁㒂㒃㒄㒅㒆㒇',    // U+3480-U+3487
  ]
});

// 6. CJK Extension B - U+20000 to U+2A6DF (rare characters, SMP)
// Note: These require surrogate pairs in UTF-16
createNonEmbeddedPdf({
  filename: 'cjk-ext-b-nonembed.pdf',
  title: 'CJK Extension B',
  fontName: 'SimSun-ExtB',
  cidOrdering: 'GB1',
  textLines: [
    'CJK Ext B U+20000-U+2A6DF',
    '𠀀𠀁𠀂𠀃',    // U+20000-U+20003
    '𠀄𠀅𠀆𠀇',    // U+20004-U+20007
  ]
});

// 7. Mixed CJK content (Japanese document style)
createNonEmbeddedPdf({
  filename: 'mixed-cjk-japanese-nonembed.pdf',
  title: 'Mixed CJK (Japanese)',
  fontName: 'MS-Mincho',
  cidOrdering: 'Japan1',
  textLines: [
    '日本語混合テスト',
    '本日は晴天なり',
    'これはテストです',
    '漢字とひらがなとカタカナ',
    '東京タワー（とうきょうタワー）',
    '２０２４年１月１日',
    '価格：￥１，２３４',
    '「こんにちは」と言った',
  ]
});

// 8. Mixed CJK content (Chinese document style)
createNonEmbeddedPdf({
  filename: 'mixed-cjk-chinese-nonembed.pdf',
  title: 'Mixed CJK (Chinese)',
  fontName: 'SimSun',
  cidOrdering: 'GB1',
  textLines: [
    '中文混合测试',
    '简体中文测试文本',
    '繁體中文測試文本',
    '日期：2024年1月1日',
    '价格：￥1,234.00',
    '电话：010-12345678',
    '"你好"世界',
    '北京市朝阳区',
  ]
});

console.log('\nGenerated Unicode test PDFs (without embedded fonts)');
console.log('These PDFs rely on system fonts and will show tofu if fonts are missing.');
