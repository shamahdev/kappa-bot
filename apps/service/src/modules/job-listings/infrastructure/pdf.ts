// PDF text extraction for CV uploads (unpdf/pdf.js, Bun-compatible).
// Shared by the discord attachment path and the service file-upload path.
import { extractText } from "unpdf";

/**
 * Extract + normalize CV text from PDF bytes. Throws a user-facing error
 * when the PDF is unreadable or holds no text (scanned/image-only).
 */
export const extractPdfText = async (data: Uint8Array): Promise<string> => {
  let raw: string;
  try {
    const result = await extractText(data, { mergePages: true });
    if (typeof result.text !== "string") {
      throw new TypeError("unexpected text shape");
    }
    raw = result.text;
  } catch {
    throw new Error(
      "Could not read this PDF — it may be corrupted. Try exporting and uploading a .txt file."
    );
  }
  const text = raw
    .replaceAll(/\r\n?/gu, "\n")
    .replaceAll(/[ \t]+$/gmu, "")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
  if (!text) {
    throw new Error(
      "No text found in this PDF — it may be scanned. Try exporting and uploading a .txt file."
    );
  }
  return text;
};
