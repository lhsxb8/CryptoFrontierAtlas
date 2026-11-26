const minorWords = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'with']);

/** Only authored interface labels. Never apply to paper titles, record text or formulas. */
export function titleCaseLabel(label: string): string {
  return label.replace(/\b[A-Za-z][A-Za-z0-9]*\b/g, (word, offset: number) =>
    offset > 0 && minorWords.has(word) || !/^[a-z]+$/.test(word)
      ? word : word[0].toUpperCase() + word.slice(1));
}
