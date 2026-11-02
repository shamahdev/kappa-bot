import type { ReactNode } from "react";

// Minimal, injection-safe Markdown for model-written report text: only
// **bold**, *italic*, `code`, paragraphs and bullet/numbered lists. Output is
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

export const Markdown = ({ text }: { text: string }) => {
  const blocks = text
    .trim()
    .split(/\n\s*\n/u)
    .filter((block) => block.trim());
  return (
    <div className="app-markdown">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (lines.every((line) => BULLET.test(line))) {
          return (
            <ul key={index}>
              {lines.map((line, item) => (
                <li key={item}>{inline(line.replace(BULLET, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, item) => (
              <span key={item}>
                {item > 0 ? <br /> : null}
                {inline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
};
