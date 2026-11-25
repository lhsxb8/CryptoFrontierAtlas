import { Formula } from './Formula';
import { readerNotes } from './presentation';

/** One renderer for constraints in tables, detail pages and comparisons. */
export function Conditions({ items }: { items: readonly string[] }) {
  const conditions = readerNotes(items);
  return conditions.length ? <ul className="a-compact-list a-conditions">{conditions.map((condition, index) => <li key={index}><Formula expression={condition} readable /></li>)}</ul> : null;
}
