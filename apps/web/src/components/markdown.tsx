import type { ReactNode } from "react";

// Minimal, injection-safe Markdown for model-written report text: only
// **bold**, *italic*, `code`, #-headings (as bold lines), paragraphs and
// bullet/numbered lists, including bullets mixed into a paragraph block. Output is
// React elements, never raw HTML.
const INLINE =
  /(?<token>\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/gu;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/u;

const inline = (text: string): ReactNode[] =>
  text.split(INLINE).map((part, index) => {
    if (!part) {
      return null;
    }
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (
      part.length > 2 &&
      ((part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_")))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });

/** Inline-only rendering, for short list items. */
export const InlineMarkdown = ({ text }: { text: string }) => (
  <>{inline(text.replace(BULLET, ""))}</>
);

const HEADING = /^\s*#{1,6}\s+/u;

interface Group {
  kind: "list" | "text";
  lines: string[];
}

/** Consecutive bullet lines form a list; other lines form a paragraph. */
const groups = (block: string): Group[] => {
  const result: Group[] = [];
  for (const line of block.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const kind = BULLET.test(line) ? "list" : "text";
    const last = result.at(-1);
    if (last?.kind === kind) {
      last.lines.push(line);
    } else {
      result.push({ kind, lines: [line] });
    }
  }
  return result;
};

const textLine = (line: string) =>
  HEADING.test(line) ? (
    <strong>{inline(line.replace(HEADING, ""))}</strong>
  ) : (
    inline(line)
  );

export const Markdown = ({ text }: { text: string }) => (
  <div className="app-markdown">
    {text
      .trim()
      .split(/\n\s*\n/u)
      .flatMap(groups)
      .map((group, index) =>
        group.kind === "list" ? (
          <ul key={index}>
            {group.lines.map((line, item) => (
              <li key={item}>{inline(line.replace(BULLET, ""))}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            {group.lines.map((line, item) => (
              <span key={item}>
                {item > 0 ? <br /> : null}
                {textLine(line)}
              </span>
            ))}
          </p>
        )
      )}
  </div>
);
