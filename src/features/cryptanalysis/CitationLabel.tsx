/** Typesetting only: citation labels come from curated source metadata. */
export function CitationLabel({ label }: { label: string }) {
  return <span className="a-citation-label">{label.split(/(\+)/).map((part, index) => part === '+' ? <sup key={index}>+</sup> : part)}</span>;
}
