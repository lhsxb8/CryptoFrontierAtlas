import type { ReactNode } from 'react';
import katex from 'katex';
import { readableMath } from './math-layout';

// TeX delimiters are not visible parentheses. Keep authored punctuation intact
// and add a text separator only where a prose word runs into an inline formula.
// Never split an explicitly adjacent mathematical product such as f$(x)$.
function proseGap(before: string, after: string, side: 'start' | 'end') {
  return side === 'start' ? /(?:[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}]{2,})$/u.test(before)
    : /^(?:[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}]{2,})/u.test(after);
}

/** Plain text is escaped by React; only untrusted, non-executable KaTeX output is inserted. */
export function MathText({ text, readable = false, display = false }: { text: string; readable?: boolean; display?: boolean }) {
  const tokenPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(<span key={`text-${index++}`}>{text.slice(cursor, match.index)}</span>);
    const token = match[0];
    const displayMode = token.startsWith('$$') || token.startsWith('\\[') || display && token.length === text.length;
    const formula = token.startsWith('$$') || token.startsWith('\\') ? token.slice(2, -2) : token.slice(1, -1);
    const before = text.slice(cursor, match.index), after = text.slice(match.index + token.length);
    if (!displayMode && proseGap(before, '', 'start')) nodes.push(<span key={`gap-${index++}`} className="math-text-gap">{'\u2009'}</span>);
    try {
      const html = katex.renderToString(readable ? readableMath(formula) : formula, { throwOnError: false, displayMode, trust: false, maxSize: 20, maxExpand: 200 });
      nodes.push(<span className={displayMode ? 'math-display' : 'math-inline'} key={`math-${index++}`} dangerouslySetInnerHTML={{ __html: html }} />);
    } catch {
      nodes.push(<span key={`fallback-${index++}`}>{token}</span>);
    }
    if (!displayMode && proseGap('', after, 'end')) nodes.push(<span key={`gap-${index++}`} className="math-text-gap">{'\u2009'}</span>);
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(<span key={`text-${index}`}>{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}

export default MathText;
