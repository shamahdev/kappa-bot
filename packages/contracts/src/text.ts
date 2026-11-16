export const normalizeText = (text: string): string =>
  text
    .replaceAll(/\r\n?/gu, "\n")
    .replaceAll(/[ \t]+$/gmu, "")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
