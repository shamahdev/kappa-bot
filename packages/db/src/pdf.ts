// PDF text extraction for CV uploads (unpdf/pdf.js, Bun-compatible).
// Shared by the discord attachment path and the service file-upload path.
import { extractText } from 'unpdf';

/**
 * Extract + normalize CV text from PDF bytes. Throws a user-facing error
 * when the PDF is unreadable or holds no text (scanned/image-only).
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  let raw: string;
  try {
    const result = await extractText(data, { mergePages: true });
    if (typeof result.text !== 'string') throw new Error('unexpected text shape');
    raw = result.text;
  } catch {
    throw new Error(
      'Could not read this PDF — it may be corrupted. Try exporting as .txt or pasting the text.',
    );
  }
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) {
    throw new Error(
      'No text found in this PDF — it may be scanned. Try exporting as .txt or pasting the text.',
    );
  }
  return text;
}
